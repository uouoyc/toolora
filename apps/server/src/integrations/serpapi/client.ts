import type {
  KeywordRankingBatchInput,
  KeywordRankingBatchOutput,
  KeywordRankingFailure,
  KeywordRankingResult,
} from "@toolora/api/contracts/keyword-ranking";
import type {
  SerpApiCheckKeysInput,
  SerpApiCheckKeysOutput,
} from "@toolora/api/contracts/serpapi";
import { z } from "zod";

const ACCOUNT_URL = "https://serpapi.com/account.json";
const SEARCH_URL = "https://serpapi.com/search.json";
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

const SearchResponseSchema = z.object({
  error: z.string().optional(),
  organic_results: z
    .array(
      z.object({
        link: z.url(),
        position: z.number().int().positive(),
      }),
    )
    .optional(),
});

type SerpApiKey = SerpApiCheckKeysInput["keys"][number];
type KeyCheckResult = SerpApiCheckKeysOutput["results"][string];
type KeywordRankingOutcome = {
  failure: KeywordRankingFailure | null;
  result: KeywordRankingResult;
};

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

function isTargetDomain(url: string, targetDomain: string) {
  return (
    new URL(url).hostname.toLowerCase().replace(/^www\./, "") === targetDomain
  );
}

function failedOutcome(
  keyword: string,
  errorCode: KeywordRankingFailure["errorCode"],
  httpStatus: number | null,
): KeywordRankingOutcome {
  return {
    failure: { errorCode, httpStatus, keyword },
    result: {
      errorCode,
      fetchedAt: null,
      keyword,
      rank: null,
      status: "failed",
      url: null,
    },
  };
}

async function errorCodeFor(response: Response, key: SerpApiKey) {
  if (response.status === 401) {
    return "INVALID_KEY" as const;
  }
  if (response.status === 403) {
    return "KEY_FORBIDDEN" as const;
  }
  if (response.status === 429) {
    const [, check] = await checkKey(key);
    return check.code === "QUOTA_EXHAUSTED" || check.code === "RATE_LIMITED"
      ? check.code
      : ("RATE_LIMITED" as const);
  }
  if (response.status >= 500) {
    return "PROVIDER_UNAVAILABLE" as const;
  }
  return "UNKNOWN_PROVIDER_ERROR" as const;
}

async function rankKeyword(
  input: KeywordRankingBatchInput,
  keyword: string,
): Promise<KeywordRankingOutcome> {
  try {
    for (let start = 0; start < input.searchDepth; start += 10) {
      const url = new URL(SEARCH_URL);
      url.searchParams.set("api_key", input.key.secret);
      url.searchParams.set("engine", "google_light");
      url.searchParams.set("gl", input.country);
      url.searchParams.set("hl", input.language);
      url.searchParams.set("q", keyword);
      url.searchParams.set("start", String(start));

      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        return failedOutcome(
          keyword,
          await errorCodeFor(response, input.key),
          response.status,
        );
      }

      const payload = SearchResponseSchema.parse(await response.json());
      if (payload.error) {
        return failedOutcome(
          keyword,
          "UNKNOWN_PROVIDER_ERROR",
          response.status,
        );
      }

      const organicResults = payload.organic_results ?? [];
      const match = organicResults
        .filter((result) => isTargetDomain(result.link, input.targetDomain))
        .reduce(
          (highest, result) =>
            !highest || result.position < highest.position ? result : highest,
          undefined as (typeof organicResults)[number] | undefined,
        );
      if (match) {
        return {
          failure: null,
          result: {
            errorCode: null,
            fetchedAt: new Date().toISOString(),
            keyword,
            rank: start + match.position,
            status: "found",
            url: match.link,
          },
        };
      }
    }

    return {
      failure: null,
      result: {
        errorCode: null,
        fetchedAt: new Date().toISOString(),
        keyword,
        rank: null,
        status: "not-found",
        url: null,
      },
    };
  } catch (error) {
    return failedOutcome(
      keyword,
      error instanceof DOMException && error.name === "TimeoutError"
        ? "REQUEST_TIMEOUT"
        : "PROVIDER_UNAVAILABLE",
      null,
    );
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
  async runKeywordRankingBatch(
    input: KeywordRankingBatchInput,
  ): Promise<KeywordRankingBatchOutput> {
    const outcomes = await Promise.all(
      input.keywords.map((keyword) => rankKeyword(input, keyword)),
    );
    return {
      failures: outcomes.flatMap((outcome) =>
        outcome.failure ? [outcome.failure] : [],
      ),
      results: outcomes.map((outcome) => outcome.result),
    };
  },
};
