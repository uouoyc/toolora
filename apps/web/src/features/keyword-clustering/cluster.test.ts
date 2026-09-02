import { describe, expect, it } from "vitest";
import {
  type ClusterRequest,
  clusterKeywords,
  type KeywordCluster,
} from "./cluster";

function request(overrides: Partial<ClusterRequest> = {}): ClusterRequest {
  return {
    evidence: {},
    groupingAccuracy: 2,
    keywords: [],
    targetDomain: null,
    ...overrides,
  };
}

/** Structural invariants 1–7 from the Keyword Clustering specification. */
function expectInvariants(output: KeywordCluster[], input: ClusterRequest) {
  const ids = new Set(output.map((cluster) => cluster.clusterId));
  expect(ids.size).toBe(output.length);
  const position = new Map(
    input.keywords.map((keyword, index) => [keyword, index]),
  );

  for (const cluster of output) {
    expect(cluster.clusterKeywords.length).toBeGreaterThan(0);
    expect(new Set(cluster.clusterKeywords).size).toBe(
      cluster.clusterKeywords.length,
    );
    for (const keyword of cluster.clusterKeywords) {
      expect(keyword).toBe(keyword.toLowerCase());
    }
    expect(cluster.clusterKeywords).toContain(cluster.primaryKeyword);
    expect(
      cluster.clusterKeywords.length === 1
        ? null
        : cluster.minimumSharedUrlPair,
    ).toEqual(
      cluster.clusterKeywords.length === 1
        ? null
        : cluster.minimumSharedUrlPair,
    );
    expect(cluster.minimumSharedUrlPair === null).toBe(
      cluster.clusterKeywords.length === 1,
    );
    expect(cluster.domainAnalysis === null).toBe(input.targetDomain === null);
    if (cluster.domainAnalysis) {
      expect(cluster.domainAnalysis.hasPossibleCannibalization).toBe(
        new Set(cluster.domainAnalysis.matchUrls).size > 1,
      );
      expect(new Set(cluster.domainAnalysis.matchUrls).size).toBe(
        cluster.domainAnalysis.matchUrls.length,
      );
    }
    const pair = cluster.minimumSharedUrlPair;
    if (pair) {
      expect(pair.keywordA).not.toBe(pair.keywordB);
      expect(pair.sharedUrlCount).toBe(pair.sharedUrls.length);
      expect(new Set(pair.sharedUrls).size).toBe(pair.sharedUrls.length);
      expect(cluster.clusterKeywords).toContain(pair.keywordA);
      expect(cluster.clusterKeywords).toContain(pair.keywordB);
      const positionA = position.get(pair.keywordA);
      const positionB = position.get(pair.keywordB);
      expect(positionA).toBeDefined();
      expect(positionB).toBeDefined();
      expect(positionA ?? 0).toBeLessThan(positionB ?? -1);
    }
  }
}

describe("complete-link clustering", () => {
  it("merges only when every cross pair meets the grouping accuracy", () => {
    const input = request({
      evidence: {
        alpha: ["u.example/1", "u.example/2", "u.example/3", "u.example/9"],
        beta: ["u.example/1", "u.example/2", "u.example/3", "u.example/8"],
        gamma: ["u.example/2", "u.example/8"],
      },
      groupingAccuracy: 2,
      keywords: ["alpha", "beta", "gamma"],
    });
    const output = clusterKeywords(input);

    expectInvariants(output, input);
    expect(output).toEqual([
      {
        clusterId: "1",
        clusterKeywords: ["alpha", "beta"],
        domainAnalysis: null,
        minimumSharedUrlPair: {
          keywordA: "alpha",
          keywordB: "beta",
          sharedUrlCount: 3,
          sharedUrls: ["u.example/1", "u.example/2", "u.example/3"],
        },
        primaryKeyword: "alpha",
      },
      {
        clusterId: "2",
        clusterKeywords: ["gamma"],
        domainAnalysis: null,
        minimumSharedUrlPair: null,
        primaryKeyword: "gamma",
      },
    ]);
  });

  it("breaks primary keyword ties by input order", () => {
    const output = clusterKeywords(
      request({
        evidence: {
          x: [
            "u.example/a",
            "u.example/b",
            "u.example/c",
            "u.example/d",
            "u.example/e",
          ],
          y: [
            "u.example/a",
            "u.example/b",
            "u.example/c",
            "u.example/d",
            "u.example/f",
          ],
          z: ["u.example/a", "u.example/b", "u.example/g", "u.example/h"],
        },
        groupingAccuracy: 2,
        keywords: ["x", "y", "z"],
      }),
    );

    expect(output).toHaveLength(1);
    expect(output[0]?.primaryKeyword).toBe("x");
    expect(output[0]?.minimumSharedUrlPair).toEqual({
      keywordA: "x",
      keywordB: "z",
      sharedUrlCount: 2,
      sharedUrls: ["u.example/a", "u.example/b"],
    });
  });

  it("breaks minimum pair ties by original pair input positions", () => {
    const output = clusterKeywords(
      request({
        evidence: {
          p: ["u.example/a", "u.example/b", "u.example/c"],
          q: [
            "u.example/a",
            "u.example/b",
            "u.example/c",
            "u.example/d",
            "u.example/e",
          ],
          r: [
            "u.example/a",
            "u.example/b",
            "u.example/c",
            "u.example/f",
            "u.example/g",
          ],
        },
        groupingAccuracy: 3,
        keywords: ["p", "q", "r"],
      }),
    );

    expect(output).toHaveLength(1);
    // Every pair shares 3 → the (p,q) input positions win the tie.
    expect(output[0]?.minimumSharedUrlPair).toEqual({
      keywordA: "p",
      keywordB: "q",
      sharedUrlCount: 3,
      sharedUrls: ["u.example/a", "u.example/b", "u.example/c"],
    });
  });

  it("orders shared URLs by keyword A's SERP rank order", () => {
    const output = clusterKeywords(
      request({
        evidence: {
          first: ["u.example/c", "u.example/a", "u.example/b"],
          second: ["u.example/b", "u.example/c", "u.example/a"],
        },
        groupingAccuracy: 2,
        keywords: ["first", "second"],
      }),
    );

    expect(output[0]?.minimumSharedUrlPair?.sharedUrls).toEqual([
      "u.example/c",
      "u.example/a",
      "u.example/b",
    ]);
  });

  it("sorts clusters by earliest input member before assigning sequential ids", () => {
    const output = clusterKeywords(
      request({
        evidence: {
          k3: ["u.example/3"],
          k1: ["u.example/1", "u.example/shared"],
          k2: ["u.example/shared", "u.example/2"],
        },
        groupingAccuracy: 1,
        keywords: ["k3", "k1", "k2"],
      }),
    );

    expect(
      output.map((cluster) => [cluster.clusterId, cluster.clusterKeywords]),
    ).toEqual([
      ["1", ["k3"]],
      ["2", ["k1", "k2"]],
    ]);
  });

  it("collects domain matches by cluster input order then SERP rank", () => {
    const input = request({
      evidence: {
        x: ["example.com/a", "shared.example/s"],
        y: ["example.com/a", "sub.example.com/c", "shared.example/s"],
        z: ["example.com/b", "shared.example/s"],
      },
      groupingAccuracy: 1,
      keywords: ["x", "y", "z"],
      targetDomain: "example.com",
    });
    const output = clusterKeywords(input);

    expectInvariants(output, input);
    expect(output).toHaveLength(1);
    expect(output[0]?.domainAnalysis).toEqual({
      hasPossibleCannibalization: true,
      matchUrls: ["example.com/a", "example.com/b"],
    });
  });

  it("reports no cannibalization for zero or one domain match", () => {
    const none = clusterKeywords(
      request({
        evidence: { x: ["other.example/1"] },
        groupingAccuracy: 1,
        keywords: ["x"],
        targetDomain: "example.com",
      }),
    );
    expect(none[0]?.domainAnalysis).toEqual({
      hasPossibleCannibalization: false,
      matchUrls: [],
    });

    const single = clusterKeywords(
      request({
        evidence: {
          x: ["example.com/a", "other.example/1"],
          y: ["example.com/a", "other.example/2"],
        },
        groupingAccuracy: 1,
        keywords: ["x", "y"],
        targetDomain: "example.com",
      }),
    );
    expect(single[0]?.domainAnalysis).toEqual({
      hasPossibleCannibalization: false,
      matchUrls: ["example.com/a"],
    });
  });

  it("returns no clusters without evidence-ready keywords", () => {
    expect(clusterKeywords(request())).toEqual([]);
  });

  it("is deterministic across repeated runs on structured input", () => {
    const evidence: Record<string, string[]> = {};
    const keywords: string[] = [];
    for (let index = 0; index < 200; index += 1) {
      const keyword = `keyword-${String(index).padStart(3, "0")}`;
      keywords.push(keyword);
      evidence[keyword] = [
        `u.example/${index % 7}`,
        `u.example/${index % 11}`,
        `u.example/${index % 13}`,
      ];
    }
    const input = request({ evidence, groupingAccuracy: 2, keywords });

    const first = clusterKeywords(input);
    const second = clusterKeywords(input);
    expect(first).toEqual(second);
    expectInvariants(first, input);
    expect(first.flatMap((cluster) => cluster.clusterKeywords).sort()).toEqual(
      [...keywords].sort(),
    );
  });

  it("re-clusters appended keywords globally instead of keeping old clusters", () => {
    const oldEvidence: Record<string, string[]> = {};
    const oldKeywords: string[] = [];
    for (let index = 0; index < 300; index += 1) {
      const keyword = `old-${String(index).padStart(3, "0")}`;
      oldKeywords.push(keyword);
      oldEvidence[keyword] = [`u.example/shared-${index}`];
    }
    const firstPhase = clusterKeywords(
      request({
        evidence: oldEvidence,
        groupingAccuracy: 1,
        keywords: oldKeywords,
      }),
    );
    expect(firstPhase).toHaveLength(300);
    expect(
      firstPhase.every((cluster) => cluster.clusterKeywords.length === 1),
    ).toBe(true);

    const appendedEvidence = { ...oldEvidence };
    const appendedKeywords = [...oldKeywords];
    for (let index = 0; index < 700; index += 1) {
      const keyword = `new-${String(index).padStart(3, "0")}`;
      appendedKeywords.push(keyword);
      appendedEvidence[keyword] = [`u.example/shared-${index % 300}`];
    }
    const input = request({
      evidence: appendedEvidence,
      groupingAccuracy: 1,
      keywords: appendedKeywords,
    });
    const output = clusterKeywords(input);
    expectInvariants(output, input);

    const mixed = output.filter((cluster) =>
      cluster.clusterKeywords.some((keyword) => keyword.startsWith("old-")),
    );
    expect(mixed).toHaveLength(300);
    for (const cluster of mixed) {
      expect(
        cluster.clusterKeywords.some((keyword) => keyword.startsWith("new-")),
      ).toBe(true);
    }
    expect(clusterKeywords(input)).toEqual(output);
  });

  it("handles the full 1000 keyword scale with grouped evidence", () => {
    const evidence: Record<string, string[]> = {};
    const keywords: string[] = [];
    for (let group = 0; group < 200; group += 1) {
      for (let member = 0; member < 5; member += 1) {
        const keyword = `kw-${group}-${member}`;
        keywords.push(keyword);
        evidence[keyword] = [
          `u.example/g${group}-1`,
          `u.example/g${group}-2`,
          `u.example/g${group}-3`,
          `u.example/g${group}-4`,
          `u.example/g${group}-5`,
          `u.example/unique-${group}-${member}`,
        ];
      }
    }
    const input = request({
      evidence,
      groupingAccuracy: 4,
      keywords,
      targetDomain: "u.example",
    });
    const output = clusterKeywords(input);
    expectInvariants(output, input);

    expect(output).toHaveLength(200);
    expect(
      output.every((cluster) => cluster.clusterKeywords.length === 5),
    ).toBe(true);
  });
});
