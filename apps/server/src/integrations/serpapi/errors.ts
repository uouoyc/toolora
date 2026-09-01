import type {
  SerpApiCheckKeysOutput,
  TooloraErrorCodeSchema,
} from "@toolora/api/contracts/serpapi";
import type { z } from "zod";

type TooloraErrorCode = z.infer<typeof TooloraErrorCodeSchema>;
type KeyCheckResult = SerpApiCheckKeysOutput["results"][string];

/** Provider request timeout shared by every SerpAPI endpoint call. */
export const REQUEST_TIMEOUT_MS = 15_000;

export function httpStatusErrorCode(status: number): TooloraErrorCode {
  if (status === 401) {
    return "INVALID_KEY";
  }
  if (status === 403) {
    return "KEY_FORBIDDEN";
  }
  if (status >= 500) {
    return "PROVIDER_UNAVAILABLE";
  }
  return "UNKNOWN_PROVIDER_ERROR";
}

export function networkErrorCode(
  error: unknown,
): "REQUEST_TIMEOUT" | "PROVIDER_UNAVAILABLE" {
  return error instanceof DOMException && error.name === "TimeoutError"
    ? "REQUEST_TIMEOUT"
    : "PROVIDER_UNAVAILABLE";
}

export async function searchErrorCodeFor(
  response: Response,
  recheckKey: () => Promise<KeyCheckResult>,
): Promise<TooloraErrorCode> {
  if (response.status === 429) {
    const check = await recheckKey();
    return check.code === "QUOTA_EXHAUSTED" || check.code === "RATE_LIMITED"
      ? check.code
      : ("RATE_LIMITED" as const);
  }
  return httpStatusErrorCode(response.status);
}
