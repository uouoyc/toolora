import {
  type KeywordRankingInput,
  KeywordRankingInputSchema,
  type KeywordRankingResult,
} from "@toolora/api/contracts/keyword-ranking";
import type { RunFailure } from "../../lib/keyword-run/types";

export type FailedKeyword = RunFailure;

export {
  createRetryBatches,
  splitKeywordBatches,
} from "../../lib/keyword-run/batches";
export {
  bindSuccessfulKeywords,
  pruneKeywordBindings,
} from "../../lib/keyword-run/key-affinity";

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

export function restoreWorkspace(workspace: KeywordRankingWorkspace | null) {
  if (workspace?.schemaVersion !== 2) {
    return null;
  }

  return workspace.run.status === "running"
    ? { ...workspace, run: { ...workspace.run, status: "paused" as const } }
    : workspace;
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
