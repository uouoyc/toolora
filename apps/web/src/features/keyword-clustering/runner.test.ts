import type { KeywordClusteringResult } from "@toolora/api/contracts/keyword-clustering";
import { describe, expect, it, vi } from "vitest";
import { runFailedBatches, runInitialBatches } from "./runner";

describe("Keyword Clustering Evidence queue", () => {
  it("records only failed keywords and keeps no-evidence out of the queue", async () => {
    const execute = vi.fn(async (input: { keywords: string[] }) => {
      const results: KeywordClusteringResult[] = input.keywords.map(
        (keyword) =>
          keyword === "bad"
            ? {
                errorCode: "PROVIDER_UNAVAILABLE" as const,
                fetchedAt: null,
                keyword,
                status: "failed" as const,
                urls: [],
              }
            : keyword === "missing"
              ? {
                  errorCode: null,
                  fetchedAt: "2026-09-02T00:00:00.000Z",
                  keyword,
                  status: "no-evidence" as const,
                  urls: [],
                }
              : {
                  errorCode: null,
                  fetchedAt: "2026-09-02T00:00:00.000Z",
                  keyword,
                  status: "evidence-ready" as const,
                  urls: [
                    { url: "https://u.example/1", urlIdentity: "u.example/1" },
                  ],
                },
      );
      return {
        failures: results.flatMap((result) =>
          result.errorCode !== null
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

    const outcome = await runInitialBatches({
      execute,
      input: {
        country: "us",
        keywords: ["alpha", "missing", "bad"],
        language: "en",
      },
      keyIds: ["key-a"],
      keys: [{ id: "key-a", secret: "secret-a" }],
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0]).toMatchObject({
      country: "us",
      key: { id: "key-a" },
      keywords: ["alpha", "missing", "bad"],
      language: "en",
    });
    expect(outcome.results.map((result) => result.status)).toEqual([
      "evidence-ready",
      "no-evidence",
      "failed",
    ]);
    expect(outcome.failures).toEqual([
      {
        attemptedKeyIds: ["key-a"],
        errorCode: "PROVIDER_UNAVAILABLE",
        httpStatus: 503,
        keyword: "bad",
      },
    ]);
  });

  it("terminates the failed queue when no eligible Key is left", async () => {
    const execute = vi.fn();
    const outcome = await runFailedBatches({
      execute,
      failures: [
        {
          attemptedKeyIds: ["key-a"],
          errorCode: "PROVIDER_UNAVAILABLE",
          httpStatus: null,
          keyword: "bad",
        },
      ],
      input: { country: "us", keywords: ["bad"], language: "en" },
      keys: [{ id: "key-a", secret: "secret-a", status: "quota-exhausted" }],
    });

    expect(execute).not.toHaveBeenCalled();
    expect(outcome.results).toEqual([
      {
        errorCode: "PROVIDER_UNAVAILABLE",
        fetchedAt: null,
        keyword: "bad",
        status: "failed",
        urls: [],
      },
    ]);
  });
});
