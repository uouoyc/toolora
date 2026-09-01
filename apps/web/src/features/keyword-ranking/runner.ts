import type {
  KeywordRankingBatchInput,
  KeywordRankingBatchOutput,
  KeywordRankingInput,
  KeywordRankingResult,
} from "@toolora/api/contracts/keyword-ranking";

import type { FailedKeyword } from "./workspace";
import { createRetryBatches, splitKeywordBatches } from "./workspace";

type RunKey = Pick<KeywordRankingBatchInput["key"], "id" | "secret"> & {
  accountId?: string | null;
  status?: string;
};

type BatchSettlement = {
  failures: FailedKeyword[];
  keyId: string | null;
  results: KeywordRankingResult[];
};

export type KeywordBatch = {
  keyId: string;
  keywords: string[];
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

function failedResult(
  keyword: string,
  errorCode: FailedKeyword["errorCode"],
): Extract<KeywordRankingResult, { status: "failed" }> {
  return {
    errorCode,
    fetchedAt: null,
    keyword,
    rank: null,
    status: "failed",
    url: null,
  };
}

function isEligible(key: RunKey) {
  return !key.status || key.status === "active" || key.status === "unknown";
}

function requestKey(key: RunKey): KeywordRankingBatchInput["key"] {
  return { id: key.id, secret: key.secret };
}

export function planKeywordBatches({
  keyIdByKeyword,
  keywords,
  unboundKeyIds,
}: {
  keyIdByKeyword: Readonly<Record<string, string>>;
  keywords: readonly string[];
  unboundKeyIds: readonly string[];
}): KeywordBatch[] {
  const groups = new Map<string, string[]>();
  const unbound: string[] = [];

  for (const keyword of keywords) {
    const keyId = keyIdByKeyword[keyword];
    if (!keyId) {
      unbound.push(keyword);
      continue;
    }
    groups.set(keyId, [...(groups.get(keyId) ?? []), keyword]);
  }

  for (const [index, batch] of splitKeywordBatches(unbound).entries()) {
    const keyId = unboundKeyIds[index];
    if (!keyId) {
      continue;
    }
    groups.set(keyId, [...(groups.get(keyId) ?? []), ...batch]);
  }

  return Array.from(groups, ([keyId, groupedKeywords]) =>
    splitKeywordBatches(groupedKeywords).map((keywords) => ({
      keyId,
      keywords,
    })),
  ).flat();
}

function updateKeyStatus(
  keys: RunKey[],
  key: RunKey,
  status: NonNullable<ReturnType<typeof keyStatusFor>>,
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

export async function runInitialBatches({
  batches: plannedBatches,
  execute,
  input,
  keyIds,
  keys,
  onBatchSettled,
  paused = () => false,
}: InitialRunOptions) {
  const batches =
    plannedBatches ??
    splitKeywordBatches(input.keywords).map((keywords, index) => ({
      keyId: keyIds?.[index] ?? "",
      keywords,
    }));
  const keyState = keys.map((key) => ({ ...key }));
  const batchResults: KeywordRankingResult[][] = [];
  const failures: FailedKeyword[] = [];
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
        selected && isEligible(selected) ? selected : keyState.find(isEligible);
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
        batchResults[batchIndex] = output.results;
        const failuresByKeyword = new Map(
          (output.failures ?? []).map((failure) => [failure.keyword, failure]),
        );
        const batchFailures = output.results.flatMap((result) =>
          result.status === "failed"
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
          const status = keyStatusFor(failure.errorCode);
          if (status) {
            updateKeyStatus(keyState, key, status);
          }
        }
        onBatchSettled?.({
          keyId: key.id,
          failures: batchFailures,
          results: output.results,
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
    Array.from({ length: Math.min(10, batches.length) }, () => runBatch()),
  );
  return { failures, results: batchResults.flat() };
}

function keyStatusFor(errorCode: FailedKeyword["errorCode"]) {
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

export async function runFailedBatches({
  execute,
  failures,
  input,
  keys,
  onBatchSettled,
  paused = () => false,
}: RetryRunOptions) {
  const keyState = keys.map((key) => ({ ...key }));
  const completed: KeywordRankingResult[] = [];
  const finalFailures: FailedKeyword[] = [];
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
    const settledResults: KeywordRankingResult[] = [];

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
        if (result.status !== "failed") {
          completed.push(result);
          settledResults.push(result);
          continue;
        }

        const failure = {
          attemptedKeyIds: [...previous.attemptedKeyIds, key.id],
          errorCode: result.errorCode,
          httpStatus: failuresByKeyword.get(result.keyword)?.httpStatus ?? null,
          keyword: result.keyword,
        } satisfies FailedKeyword;
        const status = keyStatusFor(result.errorCode);
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
