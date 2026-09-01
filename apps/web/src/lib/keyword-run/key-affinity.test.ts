import { describe, expect, it } from "vitest";
import { bindSuccessfulKeywords, pruneKeywordBindings } from "./key-affinity";

function generatedUrl() {
  return new URL("/", `https://${crypto.randomUUID()}.invalid`).toString();
}

describe("keyword run Key affinity", () => {
  it("keeps Key affinity only for keywords still present", () => {
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

  it("binds only successful keyword results to the Key that ran them", () => {
    expect(
      bindSuccessfulKeywords({ existing: "key-a" }, "key-b", [
        {
          errorCode: null,
          fetchedAt: "2026-09-01T00:00:00.000Z",
          keyword: "found",
          rank: 1,
          status: "found",
          url: generatedUrl(),
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
