import {
  type BatchQueryRequest,
  type ResultRow,
  maskKey,
} from "@/lib/keyword-ranking";
import { COUNTRIES, LANGUAGES, getCountryName } from "@/lib/search-config";

const SERPAPI_BASE = "https://serpapi.com/search";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 5000;
const ALLOWED_LIMITS = new Set([10, 20, 30, 40, 50]);
const MAX_KEYS = 20;
const MAX_BATCH_KEYWORDS = 5;
const MAX_TOTAL_KEYWORDS = 1000;
const MAX_ESTIMATED_SERP_ATTEMPTS = 10_000;
const MAX_RETRIES = 1;
const MAX_PAGE_ATTEMPTS = MAX_RETRIES + 1;
const PAGE_TIMEOUT_MS = 15_000;
const BATCH_TIMEOUT_MS = 45_000;

const keywordCache = new Map<string, CacheEntry>();

interface CacheEntry {
  rank: string;
  url: string;
  found: boolean;
  cachedAt: number;
}

interface SerpApiOrganicResult {
  position: number;
  link: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  error?: string;
}

export type SerpErrorType =
  | "auth"
  | "rate_limit"
  | "quota"
  | "param"
  | "network"
  | "unknown";

interface KeyIterator {
  next(): string;
  reportFailure(): void;
}

export interface BatchRunResult {
  results: ResultRow[];
  metrics: {
    total: number;
    found: number;
    missed: number;
    failed: number;
  };
  errors: Array<{
    keyword: string;
    keyAlias: string;
    errorType: SerpErrorType;
    message: string;
  }>;
}

class SerpApiError extends Error {
  constructor(
    message: string,
    readonly serpType: SerpErrorType,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

function buildCacheKey(
  domain: string,
  keyword: string,
  country: string,
  language: string,
  limit: number,
): string {
  return `${domain}|${keyword}|${country}|${language}|${limit}`;
}

function getCached(key: string): CacheEntry | undefined {
  const entry = keywordCache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    keywordCache.delete(key);
    return undefined;
  }
  return entry;
}

function setCached(key: string, entry: CacheEntry): void {
  if (keywordCache.size >= MAX_CACHE_SIZE) {
    for (const [k, v] of keywordCache) {
      if (Date.now() - v.cachedAt > CACHE_TTL_MS) keywordCache.delete(k);
    }
    if (keywordCache.size >= MAX_CACHE_SIZE) {
      Array.from(keywordCache.keys())
        .slice(0, Math.floor(MAX_CACHE_SIZE / 2))
        .forEach((k) => keywordCache.delete(k));
    }
  }
  keywordCache.set(key, entry);
}

export function normalizeDomain(input: string): string | null {
  try {
    const value = input.trim();
    if (!value || /\s/.test(value)) return null;
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    return parsed.hostname.replace(/^www\./, "").toLowerCase() || null;
  } catch {
    return null;
  }
}

function isUrlMatch(url: string, targetDomain: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    return host === targetDomain || host.endsWith(`.${targetDomain}`);
  } catch {
    return false;
  }
}

function classifySerpError(
  status: number,
  body?: SerpApiResponse,
): { type: SerpErrorType; message: string; retryable: boolean } {
  if (status === 401)
    return { type: "auth", message: "Invalid API key", retryable: false };
  if (status === 429)
    return {
      type: "rate_limit",
      message: "Rate limit exceeded",
      retryable: true,
    };
  if (status === 400)
    return {
      type: "param",
      message: body?.error || "Bad request parameters",
      retryable: false,
    };
  if (status === 403)
    return {
      type: "quota",
      message: "Quota exhausted or access denied",
      retryable: false,
    };
  if (status >= 500)
    return {
      type: "unknown",
      message: `SerpAPI server error (${status})`,
      retryable: true,
    };
  return {
    type: "unknown",
    message: `Unexpected status ${status}`,
    retryable: false,
  };
}

function toSerpError(err: unknown): SerpApiError {
  if (err instanceof SerpApiError) return err;
  if (err instanceof Error) {
    return new SerpApiError(err.message || "Network error", "network", true);
  }
  return new SerpApiError("Network error", "network", true);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchOnePage(
  apiKey: string,
  keyword: string,
  country: string,
  language: string,
  start: number,
  signal: AbortSignal,
): Promise<SerpApiResponse> {
  const params = new URLSearchParams({
    engine: "google_light",
    q: keyword,
    api_key: apiKey,
    gl: country,
    hl: language,
    location: getCountryName(country),
    google_domain: "google.com",
    start: String(start),
  });

  const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(PAGE_TIMEOUT_MS)]),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const classified = classifySerpError(res.status, body);
    throw new SerpApiError(
      classified.message,
      classified.type,
      classified.retryable,
    );
  }

  return res.json();
}

async function searchOnePageWithRetry(
  apiKey: string,
  keyword: string,
  country: string,
  language: string,
  start: number,
  signal: AbortSignal,
): Promise<SerpApiResponse> {
  let lastError: SerpApiError | null = null;
  for (let attempt = 0; attempt < MAX_PAGE_ATTEMPTS; attempt++) {
    try {
      return await searchOnePage(
        apiKey,
        keyword,
        country,
        language,
        start,
        signal,
      );
    } catch (err) {
      const serpError = toSerpError(err);
      if (!serpError.retryable || attempt === MAX_PAGE_ATTEMPTS - 1) {
        throw serpError;
      }
      lastError = serpError;
      await sleep(300 * 2 ** attempt);
    }
  }
  throw lastError ?? new SerpApiError("Unknown error", "unknown", false);
}

export async function searchKeyword(
  apiKey: string,
  keyword: string,
  country: string,
  language: string,
  limit: number,
  targetDomain: string,
  signal: AbortSignal,
): Promise<{ rank: string; url: string; found: boolean }> {
  const cacheKey = buildCacheKey(
    targetDomain,
    keyword,
    country,
    language,
    limit,
  );
  const cached = getCached(cacheKey);
  if (cached)
    return { rank: cached.rank, url: cached.url, found: cached.found };

  const pagesNeeded = Math.ceil(limit / 10);
  let currentStart = 0;

  for (let page = 0; page < pagesNeeded; page++) {
    const data = await searchOnePageWithRetry(
      apiKey,
      keyword,
      country,
      language,
      currentStart,
      signal,
    );
    const results = data.organic_results ?? [];
    if (results.length === 0) break;

    for (const result of results) {
      if (isUrlMatch(result.link, targetDomain)) {
        const entry = {
          rank: String(currentStart + result.position),
          url: result.link,
          found: true,
          cachedAt: Date.now(),
        };
        setCached(cacheKey, entry);
        return { rank: entry.rank, url: entry.url, found: true };
      }
    }

    const lastResult = results[results.length - 1];
    if (currentStart + lastResult.position >= limit) break;
    currentStart += 10;
  }

  const missEntry = {
    rank: "-",
    url: "-",
    found: false,
    cachedAt: Date.now(),
  };
  setCached(cacheKey, missEntry);
  return { rank: missEntry.rank, url: missEntry.url, found: false };
}

function roundRobinIterator(keys: string[], start = 0): KeyIterator {
  let idx = start;
  return {
    next() {
      const key = keys[idx % keys.length];
      idx++;
      return key;
    },
    reportFailure() {},
  };
}

function sequentialIterator(keys: string[], start = 0): KeyIterator {
  let idx = start;
  return {
    next() {
      return keys[idx % keys.length];
    },
    reportFailure() {
      idx++;
    },
  };
}

export function validateBatchRequest(
  body: Partial<BatchQueryRequest>,
):
  | { ok: true; request: BatchQueryRequest; domain: string }
  | { ok: false; error: string } {
  const { keys, strategy, domain, keywords, country, language, limit } = body;
  if (!Array.isArray(keys) || keys.length === 0) {
    return { ok: false, error: "keys is required" };
  }
  if (keys.length > MAX_KEYS) {
    return { ok: false, error: `keys cannot exceed ${MAX_KEYS}` };
  }
  if (strategy !== "roundRobin" && strategy !== "sequential") {
    return { ok: false, error: "Invalid strategy" };
  }
  const normalizedDomain =
    typeof domain === "string" ? normalizeDomain(domain) : null;
  if (!normalizedDomain) return { ok: false, error: "Invalid domain" };
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { ok: false, error: "keywords is required" };
  }
  if (keywords.length > MAX_BATCH_KEYWORDS) {
    return {
      ok: false,
      error: `Batch cannot exceed ${MAX_BATCH_KEYWORDS} keywords`,
    };
  }
  if (!ALLOWED_LIMITS.has(Number(limit))) {
    return { ok: false, error: "Invalid limit" };
  }
  if (!COUNTRIES.some((item) => item.code === country)) {
    return { ok: false, error: "Invalid country" };
  }
  if (!LANGUAGES.some((item) => item.code === language)) {
    return { ok: false, error: "Invalid language" };
  }

  const cleanKeywords = keywords
    .map((keyword) => String(keyword).trim())
    .filter(Boolean);
  if (cleanKeywords.length === 0) {
    return { ok: false, error: "keywords is required" };
  }

  const totalKeywords = Number(body.totalKeywords ?? cleanKeywords.length);
  if (
    !Number.isInteger(totalKeywords) ||
    totalKeywords < cleanKeywords.length
  ) {
    return { ok: false, error: "Invalid totalKeywords" };
  }
  if (totalKeywords > MAX_TOTAL_KEYWORDS) {
    return {
      ok: false,
      error: `Total keywords cannot exceed ${MAX_TOTAL_KEYWORDS}`,
    };
  }
  if (
    totalKeywords * Math.ceil(Number(limit) / 10) * MAX_PAGE_ATTEMPTS >
    MAX_ESTIMATED_SERP_ATTEMPTS
  ) {
    return {
      ok: false,
      error: `Estimated SerpAPI attempts cannot exceed ${MAX_ESTIMATED_SERP_ATTEMPTS}`,
    };
  }
  const keyOffset = Number(body.keyOffset ?? 0);
  if (!Number.isInteger(keyOffset) || keyOffset < 0) {
    return { ok: false, error: "Invalid keyOffset" };
  }

  return {
    ok: true,
    domain: normalizedDomain,
    request: {
      keys,
      strategy,
      domain: normalizedDomain,
      keywords: cleanKeywords,
      country: String(country),
      language: String(language),
      limit: Number(limit),
      totalKeywords,
      keyOffset,
    },
  };
}

export async function runBatch(
  request: BatchQueryRequest,
  targetDomain: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<BatchRunResult> {
  const batchSignal = AbortSignal.any([
    signal,
    AbortSignal.timeout(BATCH_TIMEOUT_MS),
  ]);
  const keyIter =
    request.strategy === "roundRobin"
      ? roundRobinIterator(request.keys, request.keyOffset)
      : sequentialIterator(request.keys, request.keyOffset);
  let found = 0;
  let failed = 0;
  const errors: BatchRunResult["errors"] = [];

  const runKeyword = async (keyword: string): Promise<ResultRow> => {
    const key = keyIter.next();
    const keyAlias = maskKey(key);

    try {
      const result = await searchKeyword(
        key,
        keyword,
        request.country,
        request.language,
        request.limit,
        targetDomain,
        batchSignal,
      );
      if (result.found) found++;
      return {
        keyword,
        rank: result.rank,
        url: result.url,
        keyAlias,
        status: result.found ? "found" : "miss",
      };
    } catch (err) {
      failed++;
      keyIter.reportFailure();
      const serpError = toSerpError(err);
      errors.push({
        keyword,
        keyAlias,
        errorType: serpError.serpType,
        message: serpError.message,
      });
      return {
        keyword,
        rank: "-",
        url: "-",
        keyAlias,
        status: "fail",
        errorType: serpError.serpType,
        errorMessage: serpError.message,
      };
    }
  };

  const results: ResultRow[] =
    request.strategy === "sequential"
      ? []
      : await Promise.all(request.keywords.map(runKeyword));

  if (request.strategy === "sequential") {
    for (const keyword of request.keywords) {
      results.push(await runKeyword(keyword));
    }
  }

  return {
    results,
    errors,
    metrics: {
      total: results.length,
      found,
      missed: results.length - found - failed,
      failed,
    },
  };
}
