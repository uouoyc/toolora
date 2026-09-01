import type { KeywordBatch, RunFailure } from "./types";

export function splitKeywordBatches(keywords: readonly string[]) {
  return Array.from({ length: Math.ceil(keywords.length / 5) }, (_, index) =>
    keywords.slice(index * 5, index * 5 + 5),
  );
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

export function createRetryBatches(
  failures: readonly RunFailure[],
  keys: readonly { id: string; status?: string }[],
) {
  const grouped = new Map<string, string[]>();
  const unresolved: string[] = [];

  for (const failure of failures) {
    const key = keys.find(
      (candidate) =>
        (candidate.status === "active" || candidate.status === "unknown") &&
        !failure.attemptedKeyIds.includes(candidate.id),
    );
    if (!key) {
      unresolved.push(failure.keyword);
      continue;
    }
    grouped.set(key.id, [...(grouped.get(key.id) ?? []), failure.keyword]);
  }

  return {
    batches: Array.from(grouped, ([keyId, keywords]) =>
      splitKeywordBatches(keywords).map((batch) => ({
        keyId,
        keywords: batch,
      })),
    ).flat(),
    unresolved,
  };
}
