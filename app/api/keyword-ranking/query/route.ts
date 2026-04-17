import { NextResponse } from "next/server";

import {
  type QueryRequest,
  type ResultRow,
  maskKey,
} from "@/lib/keyword-ranking";
import { getCountryName } from "@/lib/search-config";

const SERPAPI_BASE = "https://serpapi.com/search";
const keywordCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 2000;

interface CacheEntry {
  rank: string;
  url: string;
  found: boolean;
  cachedAt: number;
}

interface SerpApiOrganicResult {
  position: number;
  title: string;
  link: string;
  displayed_link: string;
  snippet?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  search_metadata?: { status: string };
  error?: string;
}

/* ── Cache helpers ── */

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
      const entries = Array.from(keywordCache.entries());
      entries
        .slice(0, MAX_CACHE_SIZE / 2)
        .forEach(([k]) => keywordCache.delete(k));
    }
  }
  keywordCache.set(key, entry);
}

/* ── Domain matching ── */

function normalizeDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .toLowerCase();
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

/* ── SerpAPI error classification ── */

type SerpErrorType =
  | "auth"
  | "rate_limit"
  | "quota"
  | "param"
  | "network"
  | "unknown";

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

/* ── SerpAPI search functions ── */

async function searchOnePage(
  apiKey: string,
  keyword: string,
  country: string,
  language: string,
  start: number,
): Promise<SerpApiResponse> {
  const location = getCountryName(country);
  const params = new URLSearchParams({
    engine: "google_light",
    q: keyword,
    api_key: apiKey,
    gl: country,
    hl: language,
    location,
    google_domain: "google.com",
    start: String(start),
  });

  const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    const classified = classifySerpError(res.status, body);
    throw Object.assign(new Error(classified.message), {
      serpType: classified.type,
      retryable: classified.retryable,
    });
  }

  return res.json();
}

async function searchKeyword(
  apiKey: string,
  keyword: string,
  country: string,
  language: string,
  limit: number,
  targetDomain: string,
): Promise<{ rank: string; url: string; found: boolean }> {
  const cacheKey = buildCacheKey(targetDomain, keyword, country, language, limit);
  const cached = getCached(cacheKey);
  if (cached) return { rank: cached.rank, url: cached.url, found: cached.found };

  const normalizedTarget = normalizeDomain(targetDomain);
  const pagesNeeded = Math.ceil(limit / 10);
  let currentStart = 0;

  for (let page = 0; page < pagesNeeded; page++) {
    const data = await searchOnePage(apiKey, keyword, country, language, currentStart);
    const results = data.organic_results ?? [];
    if (results.length === 0) break;

    for (const result of results) {
      if (isUrlMatch(result.link, normalizedTarget)) {
        const globalRank = currentStart + result.position;
        const entry = {
          rank: String(globalRank),
          url: result.link,
          found: true as const,
          cachedAt: Date.now(),
        };
        setCached(cacheKey, entry);
        return { rank: entry.rank, url: entry.url, found: true };
      }
    }

    const lastResult = results[results.length - 1];
    const pageMaxRank = currentStart + lastResult.position;
    if (pageMaxRank >= limit) break;

    const nextStart = page < pagesNeeded - 1 ? currentStart + 10 : null;
    if (nextStart === null) break;
    currentStart = nextStart;
  }

  const missEntry = { rank: "-", url: "-", found: false as const, cachedAt: Date.now() };
  setCached(cacheKey, missEntry);
  return { rank: missEntry.rank, url: missEntry.url, found: false };
}

/* ── Key iterators ── */

interface KeyIterator {
  next(): string;
  reportFailure(): void;
}

function roundRobinIterator(keys: string[]): KeyIterator {
  let idx = 0;
  return {
    next() {
      const key = keys[idx % keys.length];
      idx++;
      return key;
    },
    reportFailure() {
      // round-robin ignores failures, just keeps rotating
    },
  };
}

function sequentialIterator(keys: string[]): KeyIterator {
  let idx = 0;
  return {
    next() {
      return keys[idx % keys.length];
    },
    reportFailure() {
      // on failure, advance to next key
      idx++;
    },
  };
}

/* ── SSE helpers ── */

const encoder = new TextEncoder();

function sseEvent(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/* ── POST handler (SSE stream) ── */

export async function POST(request: Request) {
  let body: QueryRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { keys, strategy, domain, keywords, country, language, limit } = body;

  if (!keys || keys.length === 0 || !domain || !keywords) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const keywordList = keywords
    .split("\n")
    .map((k) => k.trim())
    .filter(Boolean);

  const abortSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const keyIter =
        strategy === "roundRobin"
          ? roundRobinIterator(keys)
          : sequentialIterator(keys);

      const BATCH_SIZE = Math.min(keys.length, 5);
      let found = 0;
      let failed = 0;
      let processed = 0;

      try {
      // Send initial progress
      controller.enqueue(
        sseEvent("progress", {
          processed: 0,
          total: keywordList.length,
        }),
      );

      for (let i = 0; i < keywordList.length; i += BATCH_SIZE) {
        // Stop processing if client disconnected
        if (abortSignal.aborted) {
          controller.close();
          return;
        }

        const batch = keywordList.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
          batch.map(async (keyword): Promise<ResultRow> => {
            const key = keyIter.next();
            const keyAlias = maskKey(key);

            try {
              const {
                rank,
                url,
                found: isFound,
              } = await searchKeyword(
                key,
                keyword,
                country,
                language,
                limit,
                domain,
              );

              if (isFound) found++;
              return {
                keyword,
                rank,
                url,
                keyAlias,
                status: isFound ? "found" : "miss",
              };
            } catch (err) {
              failed++;
              keyIter.reportFailure();
              const serpType =
                err instanceof Error &&
                "serpType" in err
                  ? (err as { serpType: SerpErrorType }).serpType
                  : "unknown";

              // Send per-keyword error detail
              controller.enqueue(
                sseEvent("keyword_error", {
                  keyword,
                  keyAlias,
                  errorType: serpType,
                  message:
                    err instanceof Error
                      ? err.message
                      : "Unknown error",
                }),
              );

              return {
                keyword,
                rank: "-",
                url: "-",
                keyAlias,
                status: "fail",
              };
            }
          }),
        );

        processed += batchResults.length;

        // Stream batch results
        controller.enqueue(sseEvent("batch", batchResults));

        // Stream progress
        controller.enqueue(
          sseEvent("progress", {
            processed,
            total: keywordList.length,
          }),
        );
      }

      // Send final done event
      const missed = keywordList.length - found - failed;
      controller.enqueue(
        sseEvent("done", {
          metrics: {
            total: keywordList.length,
            found,
            missed,
            failed,
          },
          status: failed > 0 ? "partial" : "success",
        }),
      );

      controller.close();
      } catch {
        // Client disconnected or stream error — close gracefully
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
