import { KeywordRankingInputSchema } from "@toolora/api/contracts/keyword-ranking";
import { describe, expect, it } from "vitest";
import {
  bindSuccessfulKeywords,
  createRetryBatches,
  createWorkspace,
  pruneKeywordBindings,
  restoreWorkspace,
  workspaceCsv,
} from "./workspace";

function generatedDomain() {
  return `${crypto.randomUUID()}.invalid`;
}

function generatedUrl(host: string, path = "/") {
  return new URL(path, `https://${host}`).toString();
}

describe("Keyword Ranking Workspace", () => {
  it("normalizes a Workspace and restores a running one as paused", () => {
    const targetDomain = generatedDomain();
    const workspace = createWorkspace({
      country: "US",
      keywords: ["  Alpha  ", "alpha", "Beta", ""],
      language: "EN",
      searchDepth: 20,
      targetDomain: generatedUrl(`www.${targetDomain}`, "/path"),
    });
    const withResult = {
      ...workspace,
      results: [
        {
          errorCode: null,
          fetchedAt: "2026-08-30T00:00:00.000Z",
          keyword: "alpha",
          rank: null,
          status: "not-found" as const,
          url: null,
        },
      ],
      run: { ...workspace.run, status: "running" as const },
    };

    expect(workspace.input).toEqual({
      country: "us",
      keywords: ["alpha", "beta"],
      language: "en",
      searchDepth: 20,
      targetDomain,
    });
    expect(restoreWorkspace(withResult)?.run.status).toBe("paused");
  });

  it("keeps Key affinity only for keywords still present in the textarea", () => {
    expect(
      pruneKeywordBindings(
        {
          kept: "key-a",
          "kept-2": "key-b",
          removed: "key-a",
          "removed-2": "key-c",
        },
        ["kept", "kept-2", "new"],
      ),
    ).toEqual({ kept: "key-a", "kept-2": "key-b" });
  });

  it("retries only failed keywords with an untried eligible Key", () => {
    expect(
      createRetryBatches(
        [
          {
            attemptedKeyIds: ["key-a"],
            errorCode: "RATE_LIMITED",
            httpStatus: 429,
            keyword: "alpha",
          },
          {
            attemptedKeyIds: [],
            errorCode: "PROVIDER_UNAVAILABLE",
            httpStatus: 503,
            keyword: "beta",
          },
          {
            attemptedKeyIds: ["key-a", "key-b"],
            errorCode: "INVALID_KEY",
            httpStatus: 401,
            keyword: "gamma",
          },
        ],
        [
          { id: "key-a", status: "active" },
          { id: "key-b", status: "unknown" },
        ],
      ),
    ).toEqual({
      batches: [
        { keyId: "key-b", keywords: ["alpha"] },
        { keyId: "key-a", keywords: ["beta"] },
      ],
      unresolved: ["gamma"],
    });
  });

  it("exports an UTF-8 BOM CSV without spreadsheet formulas", () => {
    const targetDomain = generatedDomain();
    const workspace = createWorkspace({
      country: "us",
      keywords: ["=SUM(1)"],
      language: "en",
      searchDepth: 10,
      targetDomain,
    });

    expect(workspaceCsv(workspace)).toContain('\uFEFF"keyword"');
    expect(workspaceCsv(workspace)).toContain('"\'=sum(1)"');
    expect(workspaceCsv(workspace)).not.toContain("secret");
  });

  it("rejects explicit non-HTTP Target Domain schemes", () => {
    const disallowed = new URL(generatedUrl(generatedDomain()));
    disallowed.protocol = "ftp:";

    expect(
      KeywordRankingInputSchema.safeParse({
        country: "us",
        keywords: ["alpha"],
        language: "en",
        searchDepth: 10,
        targetDomain: disallowed.toString(),
      }).success,
    ).toBe(false);
  });

  it("binds only successful keyword results to the Key that ran them", () => {
    expect(
      bindSuccessfulKeywords({ existing: "key-a" }, "key-b", [
        {
          errorCode: null,
          fetchedAt: "2026-09-01T00:00:00.000Z",
          keyword: "found",
          rank: 1,
          status: "found",
          url: generatedUrl(generatedDomain()),
        },
        {
          errorCode: null,
          fetchedAt: "2026-09-01T00:00:00.000Z",
          keyword: "missing",
          rank: null,
          status: "not-found",
          url: null,
        },
        {
          errorCode: "PROVIDER_UNAVAILABLE",
          fetchedAt: null,
          keyword: "failed",
          rank: null,
          status: "failed",
          url: null,
        },
      ]),
    ).toEqual({ existing: "key-a", found: "key-b", missing: "key-b" });
  });
});
