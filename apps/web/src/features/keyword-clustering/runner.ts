import type {
  KeywordClusteringBatchInput,
  KeywordClusteringBatchOutput,
  KeywordClusteringResult,
} from "@toolora/api/contracts/keyword-clustering";
import { createKeywordRunner } from "../../lib/keyword-run/runner";
import type { KeywordBatch, RunKey } from "../../lib/keyword-run/types";
import type { FailedKeyword } from "./workspace";

export { planKeywordBatches } from "../../lib/keyword-run/batches";
export type { KeywordBatch };

/** The Evidence-relevant subset of the Tool input shared by every batch. */
export type ClusteringRunInput = Pick<
  KeywordClusteringBatchInput,
  "country" | "keywords" | "language"
>;

type BatchSettlement = {
  failures: FailedKeyword[];
  keyId: string | null;
  results: KeywordClusteringResult[];
};

type InitialRunOptions = {
  batches?: readonly KeywordBatch[];
  execute: (
    input: KeywordClusteringBatchInput,
  ) => Promise<KeywordClusteringBatchOutput>;
  input: ClusteringRunInput;
  keyIds?: readonly string[];
  keys: readonly RunKey[];
  onBatchSettled?: (outcome: BatchSettlement) => void;
  paused?: () => boolean;
};

type RetryRunOptions = {
  execute: (
    input: KeywordClusteringBatchInput,
  ) => Promise<KeywordClusteringBatchOutput>;
  failures: readonly FailedKeyword[];
  input: ClusteringRunInput;
  keys: readonly RunKey[];
  onBatchSettled?: (outcome: BatchSettlement) => void;
  paused?: () => boolean;
};

const keywordClusteringRunner = createKeywordRunner<KeywordClusteringResult>({
  failedResult: (keyword, errorCode) => ({
    errorCode,
    fetchedAt: null,
    keyword,
    status: "failed",
    urls: [],
  }),
});

export function runInitialBatches(options: InitialRunOptions) {
  return keywordClusteringRunner.runInitialBatches<ClusteringRunInput>(options);
}

export function runFailedBatches(options: RetryRunOptions) {
  return keywordClusteringRunner.runFailedBatches<ClusteringRunInput>(options);
}
