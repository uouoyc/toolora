import { createRetryBatches, splitKeywordBatches } from "./batches";
import type {
  BatchExecuteFailure,
  KeywordBatch,
  KeywordRunResult,
  RunFailure,
  RunKey,
} from "./types";

/** Browser Run scheduling cap: at most ten batches of a Run execute concurrently. */
const MAX_CONCURRENT_BATCHES = 10;

export type BatchSettlement<TResult extends KeywordRunResult> = {
  failures: RunFailure[];
  keyId: string | null;
  results: TResult[];
};

type BatchExecute<TResult extends KeywordRunResult, TRunInput> = (
  input: TRunInput & {
    key: { id: string; secret: string };
    keywords: string[];
  },
) => Promise<{
  failures?: readonly BatchExecuteFailure[];
  results: readonly TResult[];
}>;

type InitialRunOptions<TResult extends KeywordRunResult, TRunInput> = {
  batches?: readonly KeywordBatch[];
  execute: BatchExecute<TResult, TRunInput>;
  input: TRunInput;
  keyIds?: readonly string[];
  keys: readonly RunKey[];
  onBatchSettled?: (outcome: BatchSettlement<TResult>) => void;
  paused?: () => boolean;
};

type RetryRunOptions<TResult extends KeywordRunResult, TRunInput> = {
  execute: BatchExecute<TResult, TRunInput>;
  failures: readonly RunFailure[];
  input: TRunInput;
  keys: readonly RunKey[];
  onBatchSettled?: (outcome: BatchSettlement<TResult>) => void;
  paused?: () => boolean;
};

/** Only these stable error codes rotate Keys; network, timeout, 5xx, and unknown failures do not. */
function keyStatusForErrorCode(errorCode: RunFailure["errorCode"]) {
  switch (errorCode) {
    case "INVALID_KEY":
      return "invalid";
    case "KEY_FORBIDDEN":
      return "forbidden";
    case "QUOTA_EXHAUSTED":
      return "quota-exhausted";
    case "RATE_LIMITED":
      return "rate-limited";
    default:
      return null;
  }
}

function isEligible(key: RunKey) {
  return !key.status || key.status === "active" || key.status === "unknown";
}

function requestKey(key: RunKey) {
  return { id: key.id, secret: key.secret };
}

function updateKeyStatus(
  keys: RunKey[],
  key: RunKey,
  status: NonNullable<ReturnType<typeof keyStatusForErrorCode>>,
) {
  for (const candidate of keys) {
    if (
      candidate.id === key.id ||
      (key.accountId !== null &&
        key.accountId !== undefined &&
        candidate.accountId === key.accountId)
    ) {
      candidate.status = status;
    }
  }
}

export function createKeywordRunner<TResult extends KeywordRunResult>({
  failedResult,
}: {
  failedResult: (
    keyword: string,
    errorCode: RunFailure["errorCode"],
  ) => TResult;
}) {
  async function runInitialBatches<
    TRunInput extends { keywords: readonly string[] },
  >({
    batches: plannedBatches,
    execute,
    input,
    keyIds,
    keys,
    onBatchSettled,
    paused = () => false,
  }: InitialRunOptions<TResult, TRunInput>) {
    const batches =
      plannedBatches ??
      splitKeywordBatches(input.keywords).map((keywords, index) => ({
        keyId: keyIds?.[index] ?? "",
        keywords,
      }));
    const keyState = keys.map((key) => ({ ...key }));
    const batchResults: TResult[][] = [];
    const failures: RunFailure[] = [];
    let nextBatch = 0;

    async function runBatch() {
      while (!paused()) {
        const batchIndex = nextBatch;
        nextBatch += 1;
        const batch = batches[batchIndex];
        if (!batch) {
          return;
        }
        const { keywords } = batch;

        const selected = keyState.find(
          (candidate) => candidate.id === batch.keyId,
        );
        const key =
          selected && isEligible(selected)
            ? selected
            : keyState.find(isEligible);
        if (!key) {
          const results = keywords.map((keyword) =>
            failedResult(keyword, "UNKNOWN_PROVIDER_ERROR"),
          );
          const batchFailures = keywords.map((keyword) => ({
            attemptedKeyIds: [],
            errorCode: "UNKNOWN_PROVIDER_ERROR" as const,
            httpStatus: null,
            keyword,
          }));
          batchResults[batchIndex] = results;
          failures.push(...batchFailures);
          onBatchSettled?.({ keyId: null, failures: batchFailures, results });
          continue;
        }

        try {
          const output = await execute({
            ...input,
            key: requestKey(key),
            keywords,
          });
          batchResults[batchIndex] = [...output.results];
          const failuresByKeyword = new Map(
            (output.failures ?? []).map((failure) => [
              failure.keyword,
              failure,
            ]),
          );
          const batchFailures = output.results.flatMap((result) =>
            result.errorCode !== null
              ? [
                  {
                    attemptedKeyIds: [key.id],
                    errorCode: result.errorCode,
                    httpStatus:
                      failuresByKeyword.get(result.keyword)?.httpStatus ?? null,
                    keyword: result.keyword,
                  },
                ]
              : [],
          );
          failures.push(...batchFailures);
          for (const failure of batchFailures) {
            const status = keyStatusForErrorCode(failure.errorCode);
            if (status) {
              updateKeyStatus(keyState, key, status);
            }
          }
          onBatchSettled?.({
            keyId: key.id,
            failures: batchFailures,
            results: [...output.results],
          });
        } catch {
          const results = keywords.map((keyword) =>
            failedResult(keyword, "PROVIDER_UNAVAILABLE"),
          );
          const batchFailures = keywords.map((keyword) => ({
            attemptedKeyIds: [key.id],
            errorCode: "PROVIDER_UNAVAILABLE" as const,
            httpStatus: null,
            keyword,
          }));
          batchResults[batchIndex] = results;
          failures.push(...batchFailures);
          onBatchSettled?.({ keyId: key.id, failures: batchFailures, results });
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(MAX_CONCURRENT_BATCHES, batches.length) },
        () => runBatch(),
      ),
    );
    return { failures, results: batchResults.flat() };
  }

  async function runFailedBatches<
    TRunInput extends { keywords: readonly string[] },
  >({
    execute,
    failures,
    input,
    keys,
    onBatchSettled,
    paused = () => false,
  }: RetryRunOptions<TResult, TRunInput>) {
    const keyState = keys.map((key) => ({ ...key }));
    const completed: TResult[] = [];
    const finalFailures: RunFailure[] = [];
    let pending = [...failures];

    while (pending.length > 0 && !paused()) {
      const failuresByKeyword = new Map(
        pending.map((failure) => [failure.keyword, failure]),
      );
      const { batches, unresolved } = createRetryBatches(pending, keyState);
      finalFailures.push(
        ...unresolved.flatMap((keyword) => {
          const failure = failuresByKeyword.get(keyword);
          return failure ? [failure] : [];
        }),
      );
      completed.push(
        ...unresolved.flatMap((keyword) => {
          const failure = failuresByKeyword.get(keyword);
          return failure
            ? [failedResult(failure.keyword, failure.errorCode)]
            : [];
        }),
      );
      pending = pending.filter(
        (failure) => !unresolved.includes(failure.keyword),
      );

      const batch = batches[0];
      if (!batch) {
        break;
      }
      const key = keyState.find((candidate) => candidate.id === batch.keyId);
      if (!key) {
        continue;
      }
      const batchFailures = batch.keywords.flatMap((keyword) => {
        const failure = failuresByKeyword.get(keyword);
        return failure ? [failure] : [];
      });
      pending = pending.filter(
        (failure) => !batch.keywords.includes(failure.keyword),
      );
      const settledResults: TResult[] = [];

      try {
        const output = await execute({
          ...input,
          key: requestKey(key),
          keywords: batch.keywords,
        });
        const failuresByKeyword = new Map(
          (output.failures ?? []).map((failure) => [failure.keyword, failure]),
        );
        for (const result of output.results) {
          const previous = batchFailures.find(
            (failure) => failure.keyword === result.keyword,
          );
          if (!previous) {
            continue;
          }
          if (result.errorCode === null) {
            completed.push(result);
            settledResults.push(result);
            continue;
          }

          const failure = {
            attemptedKeyIds: [...previous.attemptedKeyIds, key.id],
            errorCode: result.errorCode,
            httpStatus:
              failuresByKeyword.get(result.keyword)?.httpStatus ?? null,
            keyword: result.keyword,
          } satisfies RunFailure;
          const status = keyStatusForErrorCode(result.errorCode);
          if (status) {
            updateKeyStatus(keyState, key, status);
            pending.push(failure);
          } else {
            finalFailures.push(failure);
            const failed = failedResult(result.keyword, result.errorCode);
            completed.push(failed);
            settledResults.push(failed);
          }
        }
      } catch {
        for (const previous of batchFailures) {
          const failure = {
            attemptedKeyIds: [...previous.attemptedKeyIds, key.id],
            errorCode: "PROVIDER_UNAVAILABLE" as const,
            httpStatus: null,
            keyword: previous.keyword,
          };
          finalFailures.push(failure);
          const failed = failedResult(failure.keyword, failure.errorCode);
          completed.push(failed);
          settledResults.push(failed);
        }
      }

      onBatchSettled?.({
        failures: [...finalFailures, ...pending],
        keyId: key.id,
        results: settledResults,
      });
    }

    return { failures: [...finalFailures, ...pending], results: completed };
  }

  return { runFailedBatches, runInitialBatches };
}
