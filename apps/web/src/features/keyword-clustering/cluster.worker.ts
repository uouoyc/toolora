/// <reference lib="webworker" />
import { clusterKeywords } from "./cluster";
import type { WorkerRequest, WorkerResponse } from "./worker-protocol";

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const { id, request } = event.data;
  let response: WorkerResponse;
  try {
    response = { clusters: clusterKeywords(request), id, ok: true };
  } catch (error) {
    response = {
      id,
      message: error instanceof Error ? error.message : "聚类失败。",
      ok: false,
    };
  }
  self.postMessage(response);
});
