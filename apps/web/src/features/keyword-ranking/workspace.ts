import {
  type KeywordRankingInput,
  KeywordRankingInputSchema,
  type KeywordRankingResult,
} from "@toolora/api/contracts/keyword-ranking";

export type FailedKeyword = {
  attemptedKeyIds: string[];
  errorCode: Extract<KeywordRankingResult, { status: "failed" }>["errorCode"];
  httpStatus: number | null;
  keyword: string;
};

export type KeywordRankingWorkspace = {
  input: KeywordRankingInput;
  keyIdByKeyword: Record<string, string>;
  results: KeywordRankingResult[];
  run: {
    config: { keyIds: string[]; strategy: "round-robin" | "sequential" } | null;
    failures: FailedKeyword[];
    phase: "idle" | "initial" | "failed";
    status: "idle" | "running" | "paused" | "complete";
  };
  schemaVersion: 2;
  updatedAt: string;
};

export function createWorkspace(input: unknown): KeywordRankingWorkspace {
  return {
    input: KeywordRankingInputSchema.parse(input),
    keyIdByKeyword: {},
    results: [],
    run: { config: null, failures: [], phase: "idle", status: "idle" },
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
  };
}

export function pruneKeywordBindings(
  keyIdByKeyword: Readonly<Record<string, string>>,
  keywords: readonly string[],
) {
  const retained = new Set(keywords);
  return Object.fromEntries(
    Object.entries(keyIdByKeyword).filter(([keyword]) => retained.has(keyword)),
  );
}

export function restoreWorkspace(workspace: KeywordRankingWorkspace | null) {
  if (workspace?.schemaVersion !== 2) {
    return null;
  }

  return workspace.run.status === "running"
    ? { ...workspace, run: { ...workspace.run, status: "paused" as const } }
    : workspace;
}

export function bindSuccessfulKeywords(
  keyIdByKeyword: Readonly<Record<string, string>>,
  keyId: string,
  results: readonly KeywordRankingResult[],
) {
  const next = { ...keyIdByKeyword };
  for (const result of results) {
    if (result.status !== "failed") {
      next[result.keyword] = keyId;
    }
  }
  return next;
}

export function splitKeywordBatches(keywords: readonly string[]) {
  return Array.from({ length: Math.ceil(keywords.length / 5) }, (_, index) =>
    keywords.slice(index * 5, index * 5 + 5),
  );
}

export function createRetryBatches(
  failures: readonly FailedKeyword[],
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

export function summarizeResults(results: readonly KeywordRankingResult[]) {
  return results.reduce(
    (summary, result) => {
      summary[result.status] += 1;
      return summary;
    },
    { failed: 0, found: 0, "not-found": 0 },
  );
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function workspaceCsv(workspace: KeywordRankingWorkspace) {
  const header = [
    "keyword",
    "status",
    "rank",
    "url",
    "error_code",
    "country",
    "language",
    "search_depth",
    "fetched_at",
  ];
  const results = new Map(
    workspace.results.map((result) => [result.keyword, result]),
  );
  const rows = workspace.input.keywords.map((keyword) => {
    const result = results.get(keyword);
    return [
      keyword,
      result?.status ?? "",
      result?.rank ?? null,
      result?.url ?? null,
      result?.errorCode ?? null,
      workspace.input.country,
      workspace.input.language,
      workspace.input.searchDepth,
      result?.fetchedAt ?? null,
    ]
      .map(csvCell)
      .join(",");
  });

  return `\uFEFF${[header.map(csvCell).join(","), ...rows].join("\r\n")}`;
}
