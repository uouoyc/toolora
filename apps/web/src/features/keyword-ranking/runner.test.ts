import type { KeywordRankingResult } from "@toolora/api/contracts/keyword-ranking";
import { describe, expect, it, vi } from "vitest";
import {
  planKeywordBatches,
  runFailedBatches,
  runInitialBatches,
} from "./runner";

function generatedDomain() {
  return `${crypto.randomUUID()}.invalid`;
}

function generatedUrl(host: string, path = "/") {
  return new URL(path, `https://${host}`).toString();
}

describe("Keyword Ranking initial queue", () => {
  it("sends five-keyword batches once and records only failed keywords for retry", async () => {
    const targetDomain = generatedDomain();
    const execute = vi.fn(async (input) => {
      const results: KeywordRankingResult[] = input.keywords.map(
        (keyword: string) =>
          keyword === "bad"
            ? {
                errorCode: "PROVIDER_UNAVAILABLE" as const,
                fetchedAt: null,
                keyword,
                rank: null,
                status: "failed" as const,
                url: null,
              }
            : {
                errorCode: null,
                fetchedAt: "2026-09-01T00:00:00.000Z",
                keyword,
                rank: null,
                status: "not-found" as const,
                url: null,
              },
      );
      return {
        failures: results.flatMap((result) =>
          result.status === "failed"
            ? [
                {
                  errorCode: result.errorCode,
                  httpStatus: 503,
                  keyword: result.keyword,
                },
              ]
            : [],
        ),
        results,
      };
    });
    const settled = vi.fn();

    const outcome = await runInitialBatches({
      execute,
      input: {
        country: "us",
        keywords: ["one", "two", "three", "four", "five", "bad"],
        language: "en",
        searchDepth: 10,
        targetDomain,
      },
      keyIds: ["key-a", "key-b"],
      keys: [
        { id: "key-a", secret: "secret-a" },
        { id: "key-b", secret: "secret-b" },
      ],
      onBatchSettled: settled,
    });

    expect(execute).toHaveBeenCalledTimes(2);
    expect(settled).toHaveBeenCalledTimes(2);
    expect(
      new Set(settled.mock.calls.map(([outcome]) => outcome.keyId)),
    ).toEqual(new Set(["key-a", "key-b"]));
    expect(outcome.results.map((result) => result.keyword)).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "bad",
    ]);
    expect(outcome.failures).toEqual([
      {
        attemptedKeyIds: ["key-b"],
        errorCode: "PROVIDER_UNAVAILABLE",
        httpStatus: 503,
        keyword: "bad",
      },
    ]);
  });

  it("rotates a failed keyword only after a Key-specific error", async () => {
    const targetDomain = generatedDomain();
    const execute = vi.fn(async (input) => ({
      failures: [],
      results:
        input.key.id === "key-a"
          ? [
              {
                errorCode: "RATE_LIMITED" as const,
                fetchedAt: null,
                keyword: "bad",
                rank: null,
                status: "failed" as const,
                url: null,
              },
            ]
          : [
              {
                errorCode: null,
                fetchedAt: "2026-09-01T00:00:00.000Z",
                keyword: "bad",
                rank: 4,
                status: "found" as const,
                url: generatedUrl(targetDomain, "/found"),
              },
            ],
    }));
    const settled = vi.fn();

    const outcome = await runFailedBatches({
      execute,
      failures: [
        {
          attemptedKeyIds: [],
          errorCode: "PROVIDER_UNAVAILABLE",
          httpStatus: null,
          keyword: "bad",
        },
      ],
      input: {
        country: "us",
        keywords: ["bad"],
        language: "en",
        searchDepth: 10,
        targetDomain,
      },
      keys: [
        { id: "key-a", secret: "secret-a", status: "active" },
        { id: "key-b", secret: "secret-b", status: "active" },
      ],
      onBatchSettled: settled,
    });

    expect(execute.mock.calls.map(([input]) => input.key.id)).toEqual([
      "key-a",
      "key-b",
    ]);
    expect(outcome.failures).toEqual([]);
    expect(outcome.results).toMatchObject([{ keyword: "bad", rank: 4 }]);
    expect(settled).toHaveBeenCalledTimes(2);
  });

  it("stops the failed queue before scheduling another batch when paused", async () => {
    const targetDomain = generatedDomain();
    const execute = vi.fn();
    const failure = {
      attemptedKeyIds: [],
      errorCode: "PROVIDER_UNAVAILABLE" as const,
      httpStatus: null,
      keyword: "bad",
    };

    const outcome = await runFailedBatches({
      execute,
      failures: [failure],
      input: {
        country: "us",
        keywords: ["bad"],
        language: "en",
        searchDepth: 10,
        targetDomain,
      },
      keys: [{ id: "key-a", secret: "secret-a", status: "active" }],
      paused: () => true,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(outcome.failures).toEqual([failure]);
  });

  it("reselects an eligible Key for initial batches not yet scheduled", async () => {
    const targetDomain = generatedDomain();
    const execute = vi.fn(async (input) => ({
      failures: [],
      results: input.keywords.map((keyword: string) => ({
        errorCode: keyword === "keyword-0" ? ("INVALID_KEY" as const) : null,
        fetchedAt: keyword === "keyword-0" ? null : "2026-09-01T00:00:00.000Z",
        keyword,
        rank: null,
        status:
          keyword === "keyword-0"
            ? ("failed" as const)
            : ("not-found" as const),
        url: null,
      })),
    }));
    const keywords = Array.from(
      { length: 51 },
      (_, index) => `keyword-${index}`,
    );

    await runInitialBatches({
      execute,
      input: {
        country: "us",
        keywords,
        language: "en",
        searchDepth: 10,
        targetDomain,
      },
      keyIds: Array.from({ length: 11 }, () => "key-a"),
      keys: [
        { id: "key-a", secret: "secret-a", status: "active" },
        { id: "key-b", secret: "secret-b", status: "active" },
      ],
    });

    expect(execute.mock.calls.at(-1)?.[0].key.id).toBe("key-b");
  });

  it("keeps bound keywords with their Key when a refresh is replanned", () => {
    expect(
      planKeywordBatches({
        keyIdByKeyword: {
          "bound-a": "key-a",
          "bound-b": "key-b",
          "bound-a-2": "key-a",
        },
        keywords: ["bound-a", "new", "bound-b", "bound-a-2"],
        unboundKeyIds: ["key-b"],
      }),
    ).toEqual([
      { keyId: "key-a", keywords: ["bound-a", "bound-a-2"] },
      { keyId: "key-b", keywords: ["bound-b", "new"] },
    ]);
  });
});
