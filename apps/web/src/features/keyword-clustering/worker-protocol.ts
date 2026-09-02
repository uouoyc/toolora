import type { ClusterRequest, KeywordCluster } from "./cluster";

export type WorkerRequest = {
  id: number;
  request: ClusterRequest;
};

export type WorkerResponse =
  | { clusters: KeywordCluster[]; id: number; ok: true }
  | { id: number; message: string; ok: false };
