import { NextResponse } from "next/server";

import {
  type QueryRequest,
  type ResultRow,
  maskKey,
} from "@/lib/keyword-ranking";

const SERPAPI_BASE = "https://serpapi.com/search.json";
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
  search_metadata?: {
    status: string;
  };
  error?: string;
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
  // Evict oldest entries when cache is full
  if (keywordCache.size >= MAX_CACHE_SIZE && keywordCache.size % 200 === 0) {
    for (const [k, v] of keywordCache) {
      if (Date.now() - v.cachedAt > CACHE_TTL_MS) keywordCache.delete(k);
    }
    // If still too full, clear half
    if (keywordCache.size >= MAX_CACHE_SIZE) {
      const entries = Array.from(keywordCache.entries());
      entries
        .slice(0, MAX_CACHE_SIZE / 2)
        .forEach(([k]) => keywordCache.delete(k));
    }
  }
  keywordCache.set(key, entry);
}

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

/* Search one page of results for a keyword using a specific API key */
async function searchOnePage(
  apiKey: string,
  keyword: string,
  country: string,
  language: string,
  start: number,
): Promise<SerpApiResponse> {
  const params = new URLSearchParams({
    engine: "google_light",
    q: keyword,
    api_key: apiKey,
    gl: country,
    hl: language,
    start: String(start),
  });

  const res = await fetch(`${SERPAPI_BASE}?${params.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`SerpAPI HTTP ${res.status}`);
  }

  return res.json();
}

/* Find the rank of targetDomain in organic results (1-based across all pages) */
async function searchKeyword(
  apiKey: string,
  keyword: string,
  country: string,
  language: string,
  limit: number,
  targetDomain: string,
): Promise<{ rank: string; url: string; found: boolean }> {
  const cacheKey = buildCacheKey(
    targetDomain,
    keyword,
    country,
    language,
    limit,
  );
  const cached = getCached(cacheKey);
  if (cached) {
    return { rank: cached.rank, url: cached.url, found: cached.found };
  }

  const normalizedTarget = normalizeDomain(targetDomain);
  const pagesNeeded = Math.ceil(limit / 10);
  let globalRank = 0;
  let currentStart = 0;

  for (let page = 0; page < pagesNeeded; page++) {
    const data = await searchOnePage(
      apiKey,
      keyword,
      country,
      language,
      currentStart,
    );
    const results = data.organic_results ?? [];

    if (results.length === 0) break;

    for (const result of results) {
      globalRank++;
      if (globalRank > limit) break;

      if (isUrlMatch(result.link, normalizedTarget)) {
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

    const nextStart = page < pagesNeeded - 1 ? currentStart + 10 : null;
    if (nextStart === null) break;
    currentStart = nextStart;
  }

  const missEntry = {
    rank: "-",
    url: "-",
    found: false as const,
    cachedAt: Date.now(),
  };
  setCached(cacheKey, missEntry);
  return { rank: missEntry.rank, url: missEntry.url, found: false };
}

/* Round-robin key iterator */
function* roundRobinKeys(keys: string[]): Generator<string> {
  let idx = 0;
  while (true) {
    yield keys[idx % keys.length];
    idx++;
  }
}

/* Sequential key iterator — drains keys in order, one at a time */
function* sequentialKeys(keys: string[]): Generator<string> {
  let idx = 0;
  while (idx < keys.length) {
    yield keys[idx];
    idx++;
  }
}

export async function POST(request: Request) {
  try {
    const body: QueryRequest = await request.json();
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
    const taskId = crypto.randomUUID();

    const keyIterator =
      strategy === "roundRobin" ? roundRobinKeys(keys) : sequentialKeys(keys);

    const results: ResultRow[] = [];
    let found = 0;
    let failed = 0;

    // Process all keywords in parallel batches to avoid hammering the API
    const BATCH_SIZE = Math.min(keys.length, 5);

    for (let i = 0; i < keywordList.length; i += BATCH_SIZE) {
      const batch = keywordList.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (keyword) => {
          const key = keyIterator.next().value!;
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
              status: (isFound ? "found" : "miss") as ResultRow["status"],
            } satisfies ResultRow;
          } catch (err) {
            console.error(`Search failed for keyword "${keyword}":`, err);
            failed++;
            return {
              keyword,
              rank: "-",
              url: "-",
              keyAlias,
              status: "fail" as const,
            };
          }
        }),
      );

      results.push(...batchResults);
    }

    const missed = keywordList.length - found - failed;

    const task = {
      taskId,
      domain,
      keywords: keywordList,
      country,
      language,
      limit,
      results,
      metrics: {
        total: keywordList.length,
        found,
        missed,
        failed,
      },
      createdAt: Date.now(),
      status: failed > 0 ? ("partial" as const) : ("success" as const),
    };

    return NextResponse.json({
      taskId,
      results,
      metrics: task.metrics,
      status: task.status,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
