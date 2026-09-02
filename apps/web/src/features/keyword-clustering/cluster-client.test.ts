import { afterEach, describe, expect, it, vi } from "vitest";
import type { ClusterRequest, KeywordCluster } from "./cluster";
import { runClustering } from "./cluster-client";
import type { WorkerResponse } from "./worker-protocol";

const clusters: KeywordCluster[] = [
  {
    clusterId: "1",
    clusterKeywords: ["alpha", "beta"],
    domainAnalysis: null,
    minimumSharedUrlPair: null,
    primaryKeyword: "alpha",
  },
];

const request: ClusterRequest = {
  evidence: { alpha: ["https://u.example/1"], beta: ["https://u.example/1"] },
  groupingAccuracy: 1,
  keywords: ["alpha", "beta"],
  targetDomain: null,
};

class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((event: { data: WorkerResponse }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: unknown[] = [];
  terminated = false;

  constructor(
    public url: URL,
    public options?: { type?: string },
  ) {
    FakeWorker.last = this;
  }

  postMessage(data: unknown) {
    this.posted.push(data);
  }

  respond(response: WorkerResponse) {
    this.onmessage?.({ data: response });
  }

  fail() {
    this.onerror?.(new Event("error"));
  }

  terminate() {
    this.terminated = true;
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.last = null;
});

describe("clustering worker client", () => {
  it("posts the request to the worker module and resolves its clusters", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const pending = runClustering(request);
    const worker = FakeWorker.last;
    expect(worker).not.toBeNull();
    expect(worker?.url.href).toContain("cluster.worker");
    expect(worker?.options?.type).toBe("module");
    expect(worker?.posted).toHaveLength(1);

    const message = worker?.posted[0] as {
      id: number;
      request: ClusterRequest;
    };
    expect(message.request).toEqual(request);
    worker?.respond({ clusters, id: message.id, ok: true });

    await expect(pending).resolves.toEqual(clusters);
    expect(worker?.terminated).toBe(true);
  });

  it("rejects with the worker failure message", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const pending = runClustering(request);
    const worker = FakeWorker.last;
    const message = worker?.posted[0] as { id: number };
    worker?.respond({ id: message.id, message: "worker exploded", ok: false });

    await expect(pending).rejects.toThrow("worker exploded");
    expect(worker?.terminated).toBe(true);
  });

  it("rejects when the worker itself fails to run", async () => {
    vi.stubGlobal("Worker", FakeWorker);

    const pending = runClustering(request);
    FakeWorker.last?.fail();

    await expect(pending).rejects.toThrow("聚类");
    expect(FakeWorker.last?.terminated).toBe(true);
  });
});
