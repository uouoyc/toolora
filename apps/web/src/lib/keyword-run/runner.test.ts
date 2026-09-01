import { describe, expect, it, vi } from "vitest";
import { createKeywordRunner } from "./runner";
import type { KeywordRunResult } from "./types";

type TestResult = KeywordRunResult & {
  payload: string | null;
  status: "done" | "failed";
};

const runner = createKeywordRunner<TestResult>({
  failedResult: (keyword, errorCode) => ({
    errorCode,
    keyword,
    payload: null,
    status: "failed",
  }),
});

function doneResult(keyword: string): TestResult {
  return {
    errorCode: null,
    keyword,
    payload: "evidence",
    status: "done",
  };
}

describe("keyword run runner", () => {
  it("sends five-keyword batches once and records only failed keywords for retry", async () => {
    const execute = vi.fn(async (input: { keywords: string[] }) => {
      const results: TestResult[] = input.keywords.map((keyword) =>
        keyword === "bad"
          ? {
              errorCode: "PROVIDER_UNAVAILABLE" as const,
              keyword,
              payload: null,
              status: "failed" as const,
            }
          : doneResult(keyword),
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
    const settled = vi.fn();

    const outcome = await runner.runInitialBatches({
      execute,
      input: { keywords: ["one", "two", "three", "four", "five", "bad"] },
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
    const execute = vi.fn(
      async (input: { key: { id: string }; keywords: string[] }) => ({
        failures: [],
        results:
          input.key.id === "key-a"
            ? [
                {
                  errorCode: "RATE_LIMITED" as const,
                  keyword: "bad",
                  payload: null,
                  status: "failed" as const,
                },
              ]
            : [doneResult("bad")],
      }),
    );
    const settled = vi.fn();

    const outcome = await runner.runFailedBatches({
      execute,
      failures: [
        {
          attemptedKeyIds: [],
          errorCode: "PROVIDER_UNAVAILABLE",
          httpStatus: null,
          keyword: "bad",
        },
      ],
      input: { keywords: ["bad"] },
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
    expect(outcome.results).toMatchObject([{ keyword: "bad" }]);
    expect(settled).toHaveBeenCalledTimes(2);
  });

  it("stops the failed queue before scheduling another batch when paused", async () => {
    const execute = vi.fn();
    const failure = {
      attemptedKeyIds: [],
      errorCode: "PROVIDER_UNAVAILABLE" as const,
      httpStatus: null,
      keyword: "bad",
    };

    const outcome = await runner.runFailedBatches({
      execute,
      failures: [failure],
      input: { keywords: ["bad"] },
      keys: [{ id: "key-a", secret: "secret-a", status: "active" }],
      paused: () => true,
    });

    expect(execute).not.toHaveBeenCalled();
    expect(outcome.failures).toEqual([failure]);
  });

  it("reselects an eligible Key for initial batches not yet scheduled", async () => {
    const execute = vi.fn(
      async (input: { key: { id: string }; keywords: string[] }) => ({
        failures: [],
        results: input.keywords.map((keyword: string) =>
          keyword === "keyword-0"
            ? {
                errorCode: "INVALID_KEY" as const,
                keyword,
                payload: null,
                status: "failed" as const,
              }
            : doneResult(keyword),
        ),
      }),
    );
    const keywords = Array.from(
      { length: 51 },
      (_, index) => `keyword-${index}`,
    );

    await runner.runInitialBatches({
      execute,
      input: { keywords },
      keyIds: Array.from({ length: 11 }, () => "key-a"),
      keys: [
        { id: "key-a", secret: "secret-a", status: "active" },
        { id: "key-b", secret: "secret-b", status: "active" },
      ],
    });

    expect(execute.mock.calls.at(-1)?.[0].key.id).toBe("key-b");
  });

  it("caps scheduling at ten concurrent batches", async () => {
    let active = 0;
    let peak = 0;
    const execute = vi.fn(async (input: { keywords: string[] }) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return {
        failures: [],
        results: input.keywords.map((keyword) => doneResult(keyword)),
      };
    });
    const keywords = Array.from(
      { length: 200 },
      (_, index) => `keyword-${index}`,
    );

    const outcome = await runner.runInitialBatches({
      execute,
      input: { keywords },
      keyIds: Array.from({ length: 40 }, (_, index) => `key-${index}`),
      keys: [{ id: "key-0", secret: "secret-0", status: "active" }],
    });

    expect(execute).toHaveBeenCalledTimes(40);
    expect(peak).toBe(10);
    expect(outcome.failures).toEqual([]);
  });

  it("fails every keyword as unknown when no Key is eligible", async () => {
    const execute = vi.fn();

    const outcome = await runner.runInitialBatches({
      execute,
      input: { keywords: ["one", "two"] },
      keyIds: ["key-a"],
      keys: [{ id: "key-a", secret: "secret-a", status: "invalid" }],
    });

    expect(execute).not.toHaveBeenCalled();
    expect(outcome.results).toEqual([
      {
        errorCode: "UNKNOWN_PROVIDER_ERROR",
        keyword: "one",
        payload: null,
        status: "failed",
      },
      {
        errorCode: "UNKNOWN_PROVIDER_ERROR",
        keyword: "two",
        payload: null,
        status: "failed",
      },
    ]);
    expect(outcome.failures).toEqual([
      {
        attemptedKeyIds: [],
        errorCode: "UNKNOWN_PROVIDER_ERROR",
        httpStatus: null,
        keyword: "one",
      },
      {
        attemptedKeyIds: [],
        errorCode: "UNKNOWN_PROVIDER_ERROR",
        httpStatus: null,
        keyword: "two",
      },
    ]);
  });
});
