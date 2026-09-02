import {
  type KeywordClusteringInput,
  KeywordClusteringInputSchema,
  type KeywordClusteringResult,
} from "@toolora/api/contracts/keyword-clustering";
import { csvDocument } from "../../lib/csv";
import type { RunFailure } from "../../lib/keyword-run/types";
import type { ClusterRequest, KeywordCluster } from "./cluster";

export type FailedKeyword = RunFailure;

export {
  bindSuccessfulKeywords,
  pruneKeywordBindings,
} from "../../lib/keyword-run/key-affinity";

/** The keyword-level outcome vocabulary shared by the result UI and the CSV. */
export type KeywordRowStatus =
  | ""
  | "clustered"
  | "failed"
  | "no_evidence"
  | "singleton";

/**
 * Derives every keyword's row status once: No Evidence/Failed come from the
 * Evidence outcome, clustered/singleton from Cluster membership, and a
 * keyword without any result yet stays empty.
 */
export function buildKeywordStatuses(
  keywords: readonly string[],
  evidence: readonly KeywordClusteringResult[],
  clusters: readonly KeywordCluster[],
): Record<string, KeywordRowStatus> {
  const clusterByKeyword = new Map(
    clusters.flatMap((cluster) =>
      cluster.clusterKeywords.map((keyword) => [keyword, cluster]),
    ),
  );
  const statusByKeyword = new Map(
    evidence.map((result) => [result.keyword, result.status]),
  );
  return Object.fromEntries(
    keywords.map((keyword) => {
      const status = statusByKeyword.get(keyword);
      if (status === "failed" || status === "no-evidence") {
        return [keyword, status.replace("-", "_") as KeywordRowStatus];
      }
      const cluster = clusterByKeyword.get(keyword);
      if (!cluster) {
        return [keyword, "" satisfies KeywordRowStatus];
      }
      return [
        keyword,
        (cluster.clusterKeywords.length === 1
          ? "singleton"
          : "clustered") as KeywordRowStatus,
      ];
    }),
  );
}

export type KeywordClusteringWorkspace = {
  input: KeywordClusteringInput;
  keyIdByKeyword: Record<string, string>;
  evidence: KeywordClusteringResult[];
  run: {
    config: { keyIds: string[]; strategy: "round-robin" | "sequential" } | null;
    failures: FailedKeyword[];
    phase: RunPhase;
    status: RunStatus;
  };
  schemaVersion: 2;
  updatedAt: string;
};

export type RunPhase = "idle" | "initial" | "failed";
export type RunStatus = "idle" | "running" | "paused" | "complete";

export function createWorkspace(input: unknown): KeywordClusteringWorkspace {
  return {
    input: KeywordClusteringInputSchema.parse(input),
    keyIdByKeyword: {},
    evidence: [],
    run: { config: null, failures: [], phase: "idle", status: "idle" },
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
  };
}

export function restoreWorkspace(workspace: KeywordClusteringWorkspace | null) {
  if (workspace?.schemaVersion !== 2) {
    return null;
  }

  return workspace.run.status === "running"
    ? { ...workspace, run: { ...workspace.run, status: "paused" as const } }
    : workspace;
}

export function mergeEvidence(
  workspace: KeywordClusteringWorkspace,
  incoming: readonly KeywordClusteringResult[],
) {
  const byKeyword = new Map(
    workspace.evidence.map((result) => [result.keyword, result]),
  );
  for (const result of incoming) {
    byKeyword.set(result.keyword, result);
  }
  return {
    ...workspace,
    evidence: workspace.input.keywords.flatMap((keyword) => {
      const result = byKeyword.get(keyword);
      return result ? [result] : [];
    }),
    updatedAt: new Date().toISOString(),
  };
}

export function summarizeEvidence(results: readonly KeywordClusteringResult[]) {
  return results.reduce(
    (summary, result) => {
      summary[result.status] += 1;
      return summary;
    },
    { failed: 0, "evidence-ready": 0, "no-evidence": 0 },
  );
}

export function clusterRequestFrom(
  workspace: KeywordClusteringWorkspace,
): ClusterRequest {
  const ready = workspace.evidence.filter(
    (result) => result.status === "evidence-ready",
  );
  return {
    evidence: Object.fromEntries(
      ready.map((result) => [
        result.keyword,
        result.urls.map((entry) => entry.urlIdentity),
      ]),
    ),
    groupingAccuracy: workspace.input.groupingAccuracy,
    keywords: ready.map((result) => result.keyword),
    targetDomain: workspace.input.targetDomain,
  };
}

export function withoutKeyword(
  workspace: KeywordClusteringWorkspace,
  keyword: string,
) {
  const retained = new Set(
    workspace.input.keywords.filter((candidate) => candidate !== keyword),
  );
  const { [keyword]: _binding, ...keyIdByKeyword } = workspace.keyIdByKeyword;
  return {
    ...workspace,
    evidence: workspace.evidence.filter((result) => result.keyword !== keyword),
    input: { ...workspace.input, keywords: [...retained] },
    keyIdByKeyword,
    run: {
      ...workspace.run,
      failures: workspace.run.failures.filter(
        (failure) => failure.keyword !== keyword,
      ),
    },
    updatedAt: new Date().toISOString(),
  };
}

/** Default export: one row per Cluster; No Evidence/Failed keywords never appear. */
export function clusterCsv(
  workspace: KeywordClusteringWorkspace,
  clusters: readonly KeywordCluster[],
) {
  const rows = clusters.map((cluster) => {
    const pair = cluster.minimumSharedUrlPair;
    const domain = cluster.domainAnalysis;
    const hasTarget = domain !== null;
    return [
      cluster.clusterId,
      cluster.clusterKeywords.length === 1 ? "singleton" : "clustered",
      cluster.primaryKeyword,
      cluster.clusterKeywords.join(" | "),
      cluster.clusterKeywords.length,
      pair ? `${pair.keywordA} ↔ ${pair.keywordB}` : null,
      pair?.sharedUrlCount ?? null,
      hasTarget ? workspace.input.targetDomain : null,
      hasTarget ? domain.matchUrls.length : null,
      hasTarget && domain.matchUrls.length > 0
        ? domain.matchUrls.join(" | ")
        : null,
      hasTarget ? (domain.hasPossibleCannibalization ? "true" : "false") : null,
      workspace.input.country,
      workspace.input.language,
      workspace.input.groupingAccuracy,
    ];
  });

  return csvDocument([
    [
      "cluster_id",
      "cluster_status",
      "primary_keyword",
      "keywords",
      "cluster_size",
      "weakest_pair",
      "minimum_shared_url_count",
      "target_domain",
      "target_domain_match_count",
      "target_domain_match_urls",
      "has_possible_cannibalization",
      "country",
      "language",
      "grouping_accuracy",
    ],
    ...rows,
  ]);
}

/** Secondary export: one row per input keyword across all four statuses. */
export function keywordDetailCsv(
  workspace: KeywordClusteringWorkspace,
  clusters: readonly KeywordCluster[],
) {
  const clusterByKeyword = new Map(
    clusters.flatMap((cluster) =>
      cluster.clusterKeywords.map((keyword) => [keyword, cluster]),
    ),
  );
  const resultByKeyword = new Map(
    workspace.evidence.map((result) => [result.keyword, result]),
  );
  const statusByKeyword = buildKeywordStatuses(
    workspace.input.keywords,
    workspace.evidence,
    clusters,
  );

  const rows = workspace.input.keywords.map((keyword) => {
    const result = resultByKeyword.get(keyword);
    const cluster = clusterByKeyword.get(keyword);
    return [
      keyword,
      statusByKeyword[keyword] ?? "",
      cluster?.clusterId ?? null,
      cluster?.primaryKeyword ?? null,
      cluster
        ? cluster.primaryKeyword === keyword
          ? "primary"
          : "member"
        : null,
      cluster?.clusterKeywords.length ?? null,
      result
        ? result.status === "evidence-ready"
          ? result.urls.length
          : result.status === "no-evidence"
            ? 0
            : null
        : null,
      result?.errorCode ?? null,
      result?.fetchedAt ?? null,
      workspace.input.country,
      workspace.input.language,
      workspace.input.groupingAccuracy,
    ];
  });

  return csvDocument([
    [
      "keyword",
      "keyword_status",
      "cluster_id",
      "cluster_primary_keyword",
      "keyword_role",
      "cluster_size",
      "evidence_result_count",
      "error_code",
      "evidence_fetched_at",
      "country",
      "language",
      "grouping_accuracy",
    ],
    ...rows,
  ]);
}
