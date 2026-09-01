import type { KeywordRunResult } from "./types";

export function pruneKeywordBindings(
  keyIdByKeyword: Readonly<Record<string, string>>,
  keywords: readonly string[],
) {
  const retained = new Set(keywords);
  return Object.fromEntries(
    Object.entries(keyIdByKeyword).filter(([keyword]) => retained.has(keyword)),
  );
}

export function bindSuccessfulKeywords<TKeywordResult extends KeywordRunResult>(
  keyIdByKeyword: Readonly<Record<string, string>>,
  keyId: string,
  results: readonly TKeywordResult[],
) {
  const next = { ...keyIdByKeyword };
  for (const result of results) {
    if (result.errorCode === null) {
      next[result.keyword] = keyId;
    }
  }
  return next;
}
