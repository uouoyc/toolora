import type {
  KeywordRankingBatchInput,
  KeywordRankingBatchOutput,
  KeywordRankingInput,
  KeywordRankingResult,
} from "@toolora/api/contracts/keyword-ranking";
import { createKeywordRunner } from "../../lib/keyword-run/runner";
import type { KeywordBatch, RunKey } from "../../lib/keyword-run/types";
import type { FailedKeyword } from "./workspace";

export { planKeywordBatches } from "../../lib/keyword-run/batches";
export type { KeywordBatch };

type BatchSettlement = {
  failures: FailedKeyword[];
  keyId: string | null;
  results: KeywordRankingResult[];
};

type InitialRunOptions = {
  batches?: readonly KeywordBatch[];
  execute: (
    input: KeywordRankingBatchInput,
  ) => Promise<KeywordRankingBatchOutput>;
  input: KeywordRankingInput;
  keyIds?: readonly string[];
  keys: readonly RunKey[];
  onBatchSettled?: (outcome: BatchSettlement) => void;
  paused?: () => boolean;
};

type RetryRunOptions = {
  execute: (
    input: KeywordRankingBatchInput,
  ) => Promise<KeywordRankingBatchOutput>;
  failures: readonly FailedKeyword[];
  input: KeywordRankingInput;
  keys: readonly RunKey[];
  onBatchSettled?: (outcome: BatchSettlement) => void;
  paused?: () => boolean;
};

const keywordRankingRunner = createKeywordRunner<KeywordRankingResult>({
  failedResult: (keyword, errorCode) => ({
    errorCode,
    fetchedAt: null,
    keyword,
    rank: null,
    status: "failed",
    url: null,
  }),
});

export function runInitialBatches(options: InitialRunOptions) {
  return keywordRankingRunner.runInitialBatches<KeywordRankingInput>(options);
}

export function runFailedBatches(options: RetryRunOptions) {
  return keywordRankingRunner.runFailedBatches<KeywordRankingInput>(options);
}
