import { describe, expect, it } from "vitest";
import {
  createRetryBatches,
  planKeywordBatches,
  splitKeywordBatches,
} from "./batches";

describe("keyword run batches", () => {
  it("splits keywords into batches of at most five preserving order", () => {
    expect(
      splitKeywordBatches([
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
      ]),
    ).toEqual([
      ["one", "two", "three", "four", "five"],
      ["six", "seven"],
    ]);
    expect(splitKeywordBatches([])).toEqual([]);
    expect(splitKeywordBatches(["solo"])).toEqual([["solo"]]);
  });

  it("keeps bound keywords with their Key when a run is replanned", () => {
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

  it("spreads unbound keywords across the provided unbound Key ids", () => {
    expect(
      planKeywordBatches({
        keyIdByKeyword: {},
        keywords: ["one", "two", "three", "four", "five", "six"],
        unboundKeyIds: ["key-a", "key-b"],
      }),
    ).toEqual([
      { keyId: "key-a", keywords: ["one", "two", "three", "four", "five"] },
      { keyId: "key-b", keywords: ["six"] },
    ]);
  });

  it("drops unbound keywords when no unbound Key id covers their batch", () => {
    expect(
      planKeywordBatches({
        keyIdByKeyword: {},
        keywords: ["one", "two", "three", "four", "five", "six"],
        unboundKeyIds: [],
      }),
    ).toEqual([]);
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
});
