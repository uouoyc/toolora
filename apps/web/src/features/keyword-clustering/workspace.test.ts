import type { KeywordClusteringResult } from "@toolora/api/contracts/keyword-clustering";
import { describe, expect, it } from "vitest";
import type { KeywordCluster } from "./cluster";
import {
  buildKeywordStatuses,
  clusterCsv,
  clusterRequestFrom,
  createWorkspace,
  type KeywordClusteringWorkspace,
  keywordDetailCsv,
  mergeEvidence,
  restoreWorkspace,
  summarizeEvidence,
  withoutKeyword,
} from "./workspace";

function ready(
  keyword: string,
  identities: string[],
  fetchedAt = "2026-09-02T00:00:00.000Z",
): KeywordClusteringResult {
  return {
    errorCode: null,
    fetchedAt,
    keyword,
    status: "evidence-ready",
    urls: identities.map((urlIdentity) => ({
      url: `https://${urlIdentity}?utm_source=x`,
      urlIdentity,
    })),
  };
}

function noEvidence(keyword: string): KeywordClusteringResult {
  return {
    errorCode: null,
    fetchedAt: "2026-09-02T00:00:00.000Z",
    keyword,
    status: "no-evidence",
    urls: [],
  };
}

function failed(keyword: string): KeywordClusteringResult {
  return {
    errorCode: "KEY_FORBIDDEN",
    fetchedAt: null,
    keyword,
    status: "failed",
    urls: [],
  };
}

function baseWorkspace(): KeywordClusteringWorkspace {
  return createWorkspace({
    country: "us",
    groupingAccuracy: 4,
    keywords: ["alpha", "beta", "gamma"],
    language: "en",
    targetDomain: null,
  });
}

describe("Keyword Clustering workspace", () => {
  it("creates an idle workspace from parsed input", () => {
    const workspace = baseWorkspace();

    expect(workspace.input).toEqual({
      country: "us",
      groupingAccuracy: 4,
      keywords: ["alpha", "beta", "gamma"],
      language: "en",
      targetDomain: null,
    });
    expect(workspace.evidence).toEqual([]);
    expect(workspace.keyIdByKeyword).toEqual({});
    expect(workspace.run).toEqual({
      config: null,
      failures: [],
      phase: "idle",
      status: "idle",
    });
    expect(workspace.schemaVersion).toBe(2);
  });

  it("restores only the current schema and pauses interrupted runs", () => {
    expect(restoreWorkspace(null)).toBeNull();
    expect(
      restoreWorkspace({
        ...baseWorkspace(),
        schemaVersion: 3,
      } as unknown as KeywordClusteringWorkspace),
    ).toBeNull();

    const completed = baseWorkspace();
    completed.run.status = "complete";
    expect(restoreWorkspace(completed)).toEqual(completed);

    const running = baseWorkspace();
    running.run.status = "running";
    const restored = restoreWorkspace(running);
    expect(restored?.run.status).toBe("paused");
  });

  it("merges Evidence per keyword while following the input order", () => {
    let workspace = baseWorkspace();
    workspace = mergeEvidence(workspace, [
      ready("alpha", ["u.example/1"]),
      failed("beta"),
    ]);
    expect(workspace.evidence.map((result) => result.keyword)).toEqual([
      "alpha",
      "beta",
    ]);

    workspace = mergeEvidence(workspace, [
      ready("beta", ["u.example/1", "u.example/2"]),
    ]);
    expect(workspace.evidence.map((result) => result.status)).toEqual([
      "evidence-ready",
      "evidence-ready",
    ]);

    workspace = mergeEvidence(workspace, [noEvidence("gamma")]);
    expect(workspace.evidence.map((result) => result.keyword)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  it("summarizes Evidence outcomes", () => {
    const summary = summarizeEvidence([
      ready("alpha", ["u.example/1"]),
      noEvidence("beta"),
      failed("gamma"),
    ]);
    expect(summary).toEqual({
      "evidence-ready": 1,
      failed: 1,
      "no-evidence": 1,
    });
  });

  it("builds the clustering request from Evidence Ready keywords only", () => {
    let workspace = baseWorkspace();
    workspace = mergeEvidence(workspace, [
      ready("alpha", ["u.example/1"]),
      noEvidence("beta"),
      failed("gamma"),
    ]);

    expect(clusterRequestFrom(workspace)).toEqual({
      evidence: { alpha: ["u.example/1"] },
      groupingAccuracy: 4,
      keywords: ["alpha"],
      targetDomain: null,
    });
  });

  it("derives every keyword row status from Evidence and Cluster membership", () => {
    const evidence = [
      ready("alpha", ["u.example/1"]),
      ready("beta", ["u.example/1"]),
      ready("solo", ["u.example/2"]),
      noEvidence("gamma"),
      failed("delta"),
    ];
    const clusters: KeywordCluster[] = [
      {
        clusterId: "1",
        clusterKeywords: ["alpha", "beta"],
        domainAnalysis: null,
        minimumSharedUrlPair: null,
        primaryKeyword: "alpha",
      },
      {
        clusterId: "2",
        clusterKeywords: ["solo"],
        domainAnalysis: null,
        minimumSharedUrlPair: null,
        primaryKeyword: "solo",
      },
    ];

    expect(
      buildKeywordStatuses(
        ["alpha", "beta", "solo", "gamma", "delta", "pending"],
        evidence,
        clusters,
      ),
    ).toEqual({
      alpha: "clustered",
      beta: "clustered",
      solo: "singleton",
      gamma: "no_evidence",
      delta: "failed",
      pending: "",
    });
  });

  it("removes a keyword with its Evidence and Key binding", () => {
    let workspace = baseWorkspace();
    workspace = mergeEvidence(workspace, [
      ready("alpha", ["u.example/1"]),
      ready("beta", ["u.example/2"]),
    ]);
    workspace.keyIdByKeyword = { alpha: "key-1", beta: "key-2" };

    workspace = withoutKeyword(workspace, "alpha");
    expect(workspace.input.keywords).toEqual(["beta", "gamma"]);
    expect(workspace.evidence.map((result) => result.keyword)).toEqual([
      "beta",
    ]);
    expect(workspace.keyIdByKeyword).toEqual({ beta: "key-2" });
  });
});

describe("Keyword Clustering CSV exports", () => {
  const clusters: KeywordCluster[] = [
    {
      clusterId: "1",
      clusterKeywords: ["alpha", "beta"],
      domainAnalysis: {
        hasPossibleCannibalization: true,
        matchUrls: ["example.com/a", "example.com/b"],
      },
      minimumSharedUrlPair: {
        keywordA: "alpha",
        keywordB: "beta",
        sharedUrlCount: 3,
        sharedUrls: ["example.com/a", "example.com/b", "example.com/c"],
      },
      primaryKeyword: "alpha",
    },
    {
      clusterId: "2",
      clusterKeywords: ["delta"],
      domainAnalysis: { hasPossibleCannibalization: false, matchUrls: [] },
      minimumSharedUrlPair: null,
      primaryKeyword: "delta",
    },
  ];

  function csvWorkspace(): KeywordClusteringWorkspace {
    const workspace = createWorkspace({
      country: "us",
      groupingAccuracy: 4,
      keywords: ["alpha", "beta", "gamma", "delta", "epsilon", "zeta"],
      language: "en",
      targetDomain: "example.com",
    });
    return mergeEvidence(workspace, [
      ready("alpha", ["example.com/a"]),
      ready("beta", ["example.com/b"]),
      noEvidence("gamma"),
      ready("delta", ["other.example/1"]),
      failed("epsilon"),
    ]);
  }

  it("writes one cluster row per Cluster with the spec columns", () => {
    const csv = clusterCsv(csvWorkspace(), clusters);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      `\uFEFF${[
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
      ]
        .map((column) => `"${column}"`)
        .join(",")}`,
    );
    expect(lines).toHaveLength(3);
    expect(csv).not.toContain("gamma");
    expect(csv).not.toContain("epsilon");
  });

  it("fills clustered and singleton rows with weakest pair and target fields", () => {
    const csv = clusterCsv(csvWorkspace(), clusters);
    const [, clustered, singleton] = csv.split("\r\n");

    expect(clustered).toBe(
      [
        '"1"',
        '"clustered"',
        '"alpha"',
        '"alpha | beta"',
        '"2"',
        '"alpha ↔ beta"',
        '"3"',
        '"example.com"',
        '"2"',
        '"example.com/a | example.com/b"',
        '"true"',
        '"us"',
        '"en"',
        '"4"',
      ].join(","),
    );
    expect(singleton).toBe(
      [
        '"2"',
        '"singleton"',
        '"delta"',
        '"delta"',
        '"1"',
        '""',
        '""',
        '"example.com"',
        '"0"',
        '""',
        '"false"',
        '"us"',
        '"en"',
        '"4"',
      ].join(","),
    );
  });

  it("blanks the target columns of the Cluster CSV without a Target Domain", () => {
    const workspace = createWorkspace({
      country: "us",
      keywords: ["alpha", "beta"],
      language: "en",
    });
    const noTarget = mergeEvidence(workspace, [
      ready("alpha", ["u.example/1"]),
      ready("beta", ["u.example/1"]),
    ]);
    const csv = clusterCsv(noTarget, [
      {
        clusterId: "1",
        clusterKeywords: ["alpha", "beta"],
        domainAnalysis: null,
        minimumSharedUrlPair: {
          keywordA: "alpha",
          keywordB: "beta",
          sharedUrlCount: 1,
          sharedUrls: ["u.example/1"],
        },
        primaryKeyword: "alpha",
      },
    ]);

    const [, clustered] = csv.split("\r\n");
    expect(clustered).toContain('""');
    expect(clustered).not.toContain("example");
    expect(clustered).toContain('"alpha ↔ beta"');
  });

  it("writes one keyword row per input keyword with roles and counts", () => {
    const csv = keywordDetailCsv(csvWorkspace(), clusters);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      `\uFEFF${[
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
      ]
        .map((column) => `"${column}"`)
        .join(",")}`,
    );
    expect(lines).toHaveLength(7);
  });

  it("fills primary, member, no-evidence, failed, and pending keyword rows", () => {
    const csv = keywordDetailCsv(csvWorkspace(), clusters);
    const [, primary, member, missing, singleton, failedRow, pending] =
      csv.split("\r\n");

    expect(primary).toContain('"alpha"');
    expect(primary).toContain('"clustered"');
    expect(primary).toContain('"1"');
    expect(primary).toContain('"primary"');
    expect(primary).toContain('"2"');
    expect(primary).toContain('"1"');
    expect(primary).toContain('"2026-09-02');

    expect(member).toContain('"member"');
    expect(member).toContain('"beta"');

    expect(missing).toContain('"no_evidence"');
    expect(missing).toContain('"0"');
    expect(missing).not.toContain('"primary"');
    expect(missing).not.toContain('"member"');

    expect(singleton).toContain('"singleton"');
    expect(singleton).toContain('"delta"');

    expect(failedRow).toContain('"failed"');
    expect(failedRow).toContain('"KEY_FORBIDDEN"');
    expect(failedRow).not.toContain('"2026-09-02');

    expect(pending).toContain('"zeta"');
    expect(pending).not.toContain('"clustered"');
    expect(pending).not.toContain('"KEY_FORBIDDEN"');
  });

  it("keeps the full shared URL list out of both exports", () => {
    const workspace = csvWorkspace();
    expect(clusterCsv(workspace, clusters)).not.toContain("example.com/c");
    expect(keywordDetailCsv(workspace, clusters)).not.toContain(
      "example.com/c",
    );
    expect(clusterCsv(workspace, clusters).startsWith("\uFEFF")).toBe(true);
  });

  it("protects formula injections in the keyword detail export", () => {
    const workspace = createWorkspace({
      country: "us",
      keywords: ["=sum(alpha)"],
      language: "en",
    });
    const withFailure = mergeEvidence(workspace, [failed("=sum(alpha)")]);
    const csv = keywordDetailCsv(withFailure, []);

    expect(csv).toContain('"\'=sum(alpha)"');
    expect(csv).toContain('"KEY_FORBIDDEN"');
  });
});
