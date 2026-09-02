import type { ClusterRequest, KeywordCluster } from "./cluster";
import type { WorkerResponse } from "./worker-protocol";

let requestSeq = 0;

/** Runs one clustering request on a dedicated Web Worker. */
export function runClustering(
  request: ClusterRequest,
): Promise<KeywordCluster[]> {
  requestSeq += 1;
  const id = requestSeq;

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./cluster.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      if (event.data.id !== id) {
        return;
      }
      worker.terminate();
      if (event.data.ok) {
        resolve(event.data.clusters);
      } else {
        reject(new Error(event.data.message));
      }
    };
    worker.onerror = () => {
      worker.terminate();
      reject(new Error("聚类 Worker 无法运行。"));
    };
    worker.postMessage({ id, request });
  });
}
