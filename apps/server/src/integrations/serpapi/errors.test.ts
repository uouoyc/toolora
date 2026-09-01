import { describe, expect, it, vi } from "vitest";
import { httpStatusErrorCode, networkErrorCode } from "./errors";

describe("SerpAPI stable error mapping", () => {
  it("maps Key-specific and Provider HTTP statuses to stable codes", () => {
    expect(httpStatusErrorCode(401)).toBe("INVALID_KEY");
    expect(httpStatusErrorCode(403)).toBe("KEY_FORBIDDEN");
    expect(httpStatusErrorCode(500)).toBe("PROVIDER_UNAVAILABLE");
    expect(httpStatusErrorCode(503)).toBe("PROVIDER_UNAVAILABLE");
    expect(httpStatusErrorCode(400)).toBe("UNKNOWN_PROVIDER_ERROR");
    expect(httpStatusErrorCode(404)).toBe("UNKNOWN_PROVIDER_ERROR");
  });

  it("maps provider request failures with timeout disambiguation", () => {
    expect(
      networkErrorCode(new DOMException("timed out", "TimeoutError")),
    ).toBe("REQUEST_TIMEOUT");
    expect(networkErrorCode(new TypeError("fetch failed"))).toBe(
      "PROVIDER_UNAVAILABLE",
    );
  });

  it("disambiguates HTTP 429 through the Key account check", async () => {
    const { searchErrorCodeFor } = await import("./errors");
    const response = () => new Response(null, { status: 429 });

    const quotaCheck = vi.fn().mockResolvedValue({
      code: "QUOTA_EXHAUSTED" as const,
    });
    await expect(searchErrorCodeFor(response(), quotaCheck)).resolves.toBe(
      "QUOTA_EXHAUSTED",
    );

    const rateCheck = vi.fn().mockResolvedValue({
      code: "RATE_LIMITED" as const,
    });
    await expect(searchErrorCodeFor(response(), rateCheck)).resolves.toBe(
      "RATE_LIMITED",
    );

    const inconclusiveCheck = vi.fn().mockResolvedValue({ code: null });
    await expect(
      searchErrorCodeFor(response(), inconclusiveCheck),
    ).resolves.toBe("RATE_LIMITED");
  });

  it("maps non-429 search statuses without an account check", async () => {
    const { searchErrorCodeFor } = await import("./errors");
    const check = vi.fn();

    await expect(
      searchErrorCodeFor(new Response(null, { status: 403 }), check),
    ).resolves.toBe("KEY_FORBIDDEN");
    expect(check).not.toHaveBeenCalled();
  });
});
