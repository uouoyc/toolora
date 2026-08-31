import type {
  SerpApiCheckKeysInput,
  SerpApiCheckKeysOutput,
} from "@toolora/api/contracts/serpapi";
import { z } from "zod";

const ACCOUNT_URL = "https://serpapi.com/account.json";
const CONCURRENCY = 10;
const TIMEOUT_MS = 15_000;

const AccountResponseSchema = z.object({
  account_id: z.string().min(1),
  account_rate_limit_per_hour: z.number().nonnegative(),
  plan_name: z.string().nullable().optional(),
  searches_per_month: z.number().nonnegative().nullable().optional(),
  this_hour_searches: z.number().nonnegative(),
  total_searches_left: z.number().nonnegative(),
});

type SerpApiKey = SerpApiCheckKeysInput["keys"][number];
type KeyCheckResult = SerpApiCheckKeysOutput["results"][string];

function createKeyCheckResult(
  status: KeyCheckResult["status"],
  code: KeyCheckResult["code"],
  account?: z.infer<typeof AccountResponseSchema>,
): KeyCheckResult {
  return {
    accountId: account?.account_id ?? null,
    checkedAt: new Date().toISOString(),
    code,
    hourlyLimit: account?.account_rate_limit_per_hour ?? null,
    hourlyUsed: account?.this_hour_searches ?? null,
    monthlyLimit: account?.searches_per_month ?? null,
    planName: account?.plan_name ?? null,
    searchesLeft: account?.total_searches_left ?? null,
    status,
  };
}

async function checkKey(key: SerpApiKey): Promise<[string, KeyCheckResult]> {
  const url = new URL(ACCOUNT_URL);
  // SerpAPI Account API accepts the Key only as this server-side query parameter.
  url.searchParams.set("api_key", key.secret);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 401) {
      return [key.id, createKeyCheckResult("invalid", "INVALID_KEY")];
    }
    if (response.status === 403) {
      return [key.id, createKeyCheckResult("forbidden", "KEY_FORBIDDEN")];
    }
    if (response.status === 429) {
      return [key.id, createKeyCheckResult("rate-limited", "RATE_LIMITED")];
    }
    if (!response.ok) {
      return [
        key.id,
        createKeyCheckResult(
          "unknown",
          response.status >= 500
            ? "PROVIDER_UNAVAILABLE"
            : "UNKNOWN_PROVIDER_ERROR",
        ),
      ];
    }

    const account = AccountResponseSchema.parse(await response.json());
    if (account.total_searches_left === 0) {
      return [
        key.id,
        createKeyCheckResult("quota-exhausted", "QUOTA_EXHAUSTED", account),
      ];
    }
    if (account.this_hour_searches >= account.account_rate_limit_per_hour) {
      return [
        key.id,
        createKeyCheckResult("rate-limited", "RATE_LIMITED", account),
      ];
    }
    return [key.id, createKeyCheckResult("active", null, account)];
  } catch (error) {
    return [
      key.id,
      createKeyCheckResult(
        "unknown",
        error instanceof DOMException && error.name === "TimeoutError"
          ? "REQUEST_TIMEOUT"
          : "PROVIDER_UNAVAILABLE",
      ),
    ];
  }
}

export const serpApiClient = {
  async checkKeys(keys: SerpApiCheckKeysInput["keys"]) {
    const results: Array<[string, KeyCheckResult]> = [];
    let index = 0;

    async function worker() {
      while (index < keys.length) {
        const key = keys[index++];
        if (key) {
          results.push(await checkKey(key));
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker),
    );
    return { results: Object.fromEntries(results) };
  },
};
