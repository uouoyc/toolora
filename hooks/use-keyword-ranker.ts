"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { type KeyHealthRow, type ResultRow } from "@/lib/keyword-ranking";

// Storage keys
const STORAGE_KEY = "toolora-kr-keys";
const STRATEGY_KEY = "toolora-kr-strategy";
const FORM_KEY = "toolora-kr-form";
const DRAWER_KEY = "toolora-kr-drawer";
const RUN_KEY = "toolora-kr-run";

// Default values (US / English — no domain/keywords defaults per spec)
const DEFAULT_COUNTRY = "US";
const DEFAULT_LANGUAGE = "en";
const DEFAULT_LIMIT = 20;
const BATCH_SIZE = 5;
const MAX_KEYS = 20;
const MAX_TOTAL_KEYWORDS = 1000;
const MAX_PAGE_ATTEMPTS = 2;
const MAX_ESTIMATED_ATTEMPTS = 10_000;
const ALLOWED_LIMITS = new Set([10, 20, 30, 40, 50]);

function normalizeLimit(value: unknown): number {
  const numeric = Number(value);
  if (ALLOWED_LIMITS.has(numeric)) return numeric;
  if (Number.isFinite(numeric) && numeric > 50) return 50;
  return DEFAULT_LIMIT;
}

/* Storage helpers (safe to call on server — return defaults) */
function loadStoredKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function loadStoredStrategy(): "roundRobin" | "sequential" {
  if (typeof window === "undefined") return "roundRobin";
  return (
    (localStorage.getItem(STRATEGY_KEY) as "roundRobin" | "sequential") ??
    "roundRobin"
  );
}

function loadStoredForm(): {
  domain: string;
  keywords: string;
  country: string;
  language: string;
  limit: number;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadStoredRun(): StoredRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Re-export for consumers
export type { ResultRow } from "@/lib/keyword-ranking";

export interface QueryMetrics {
  total: number;
  found: number;
  missed: number;
  failed: number;
}

export interface QueryProgress {
  processed: number;
  total: number;
}

type QueryStatus =
  | "idle"
  | "running"
  | "paused"
  | "success"
  | "partial"
  | "failed";

interface StoredRun {
  results: ResultRow[];
  metrics: QueryMetrics;
  progress: QueryProgress | null;
  status: QueryStatus;
  domain: string;
  keywords: string;
  country: string;
  language: string;
  limit: number;
  strategy: "roundRobin" | "sequential";
  signature: string;
  updatedAt: number;
}

export interface UseKeywordRankerReturn {
  // Form state
  domain: string;
  keywords: string;
  country: string;
  language: string;
  limit: number;
  setDomain: (v: string) => void;
  setKeywords: (v: string) => void;
  setCountry: (v: string) => void;
  setLanguage: (v: string) => void;
  setLimit: (v: number) => void;

  // Settings drawer
  isDrawerOpen: boolean;
  setIsDrawerOpen: (v: boolean) => void;

  // Keys & strategy
  keys: string[];
  strategy: "roundRobin" | "sequential";
  handleStrategyChange: (s: "roundRobin" | "sequential") => void;
  handleKeysChange: (newKeys: string[]) => void;

  // Query
  results: ResultRow[];
  paginatedResults: ResultRow[];
  isQuerying: boolean;
  queryStatus: QueryStatus;
  queryError: string | null;
  queryProgress: QueryProgress | null;
  metrics: QueryMetrics;
  estimatedCalls: number;
  queryBlockReason: string | null;
  canResume: boolean;
  failedCount: number;
  handleQueryStart: () => Promise<void>;
  handleQueryPause: () => void;
  handleQueryResume: () => Promise<void>;
  handleRetryFailed: () => Promise<void>;

  // Pagination
  currentPage: number;
  pageSize: number;
  handlePageChange: (page: number) => void;
  handlePageSizeChange: (size: number) => void;

  // Export
  handleExportWithKey: () => Promise<KeyHealthRow[]>;
}

/* Hook */
export function useKeywordRanker(): UseKeywordRankerReturn {
  const stored = loadStoredForm();

  // Form — always start with defaults to avoid hydration mismatch
  const [domain, setDomain] = useState(stored?.domain ?? "");
  const [keywords, setKeywords] = useState(stored?.keywords ?? "");
  const [country, setCountry] = useState(stored?.country ?? DEFAULT_COUNTRY);
  const [language, setLanguage] = useState(
    stored?.language ?? DEFAULT_LANGUAGE,
  );
  const [limit, setLimit] = useState(normalizeLimit(stored?.limit));

  // Drawer — always start closed
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [strategy, setStrategy] = useState<"roundRobin" | "sequential">(() =>
    loadStoredStrategy(),
  );
  // Keys — always start empty
  const [keys, setKeys] = useState<string[]>([]);

  // Query state
  const [results, setResults] = useState<ResultRow[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryStatus, setQueryStatus] = useState<QueryStatus>("idle");
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryProgress, setQueryProgress] = useState<QueryProgress | null>(
    null,
  );
  const [metrics, setMetrics] = useState<QueryMetrics>({
    total: 0,
    found: 0,
    missed: 0,
    failed: 0,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // AbortController ref for cancelling in-flight batch queries
  const abortRef = useRef<AbortController | null>(null);
  const pauseRef = useRef(false);

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, currentPage, pageSize]);

  const keywordList = useMemo(
    () =>
      keywords
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean),
    [keywords],
  );
  const runSignature = useMemo(
    () =>
      JSON.stringify({
        domain: domain.trim(),
        keywords: keywordList,
        country,
        language,
        limit,
        strategy,
      }),
    [country, domain, keywordList, language, limit, strategy],
  );
  const estimatedCalls =
    keywordList.length * Math.ceil(limit / 10) * MAX_PAGE_ATTEMPTS;
  const queryBlockReason = useMemo(() => {
    if (keys.length > MAX_KEYS) return `keys cannot exceed ${MAX_KEYS}`;
    if (keywordList.length > MAX_TOTAL_KEYWORDS) {
      return `Total keywords cannot exceed ${MAX_TOTAL_KEYWORDS}`;
    }
    if (estimatedCalls > MAX_ESTIMATED_ATTEMPTS) {
      return `Estimated SerpAPI attempts cannot exceed ${MAX_ESTIMATED_ATTEMPTS}`;
    }
    return null;
  }, [estimatedCalls, keys.length, keywordList.length]);
  const canResume =
    queryStatus === "paused" && loadStoredRun()?.signature === runSignature;
  const failedCount = results.filter((row) => row.status === "fail").length;

  // After mount: restore persisted state (fixes H1 hydration mismatch)
  useEffect(() => {
    const stored2 = loadStoredForm();
    if (stored2) {
      setDomain(stored2.domain ?? "");
      setKeywords(stored2.keywords ?? "");
      setCountry(stored2.country ?? DEFAULT_COUNTRY);
      setLanguage(stored2.language ?? DEFAULT_LANGUAGE);
      setLimit(normalizeLimit(stored2.limit));
    }
    setKeys(loadStoredKeys());

    const storedRun = loadStoredRun();
    if (storedRun) {
      setResults(storedRun.results ?? []);
      setMetrics(
        storedRun.metrics ?? { total: 0, found: 0, missed: 0, failed: 0 },
      );
      setQueryProgress(storedRun.progress ?? null);
      setQueryStatus(
        storedRun.status === "running" ? "paused" : storedRun.status,
      );
    }
  }, []);

  // Persist strategy + form state + drawer to localStorage
  useEffect(() => {
    localStorage.setItem(STRATEGY_KEY, strategy);
  }, [strategy]);

  useEffect(() => {
    localStorage.setItem(
      FORM_KEY,
      JSON.stringify({ domain, keywords, country, language, limit }),
    );
  }, [domain, keywords, country, language, limit]);

  useEffect(() => {
    localStorage.setItem(DRAWER_KEY, isDrawerOpen ? "1" : "0");
  }, [isDrawerOpen]);

  // Handlers
  const handleStrategyChange = useCallback((s: "roundRobin" | "sequential") => {
    setStrategy(s);
  }, []);

  const handleKeysChange = useCallback((newKeys: string[]) => {
    setKeys(newKeys);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newKeys));
  }, []);

  const handleLimitChange = useCallback((value: number) => {
    setLimit(normalizeLimit(value));
  }, []);

  const persistRun = useCallback(
    (
      nextResults: ResultRow[],
      nextMetrics: QueryMetrics,
      nextProgress: QueryProgress | null,
      nextStatus: QueryStatus,
    ) => {
      localStorage.setItem(
        RUN_KEY,
        JSON.stringify({
          results: nextResults,
          metrics: nextMetrics,
          progress: nextProgress,
          status: nextStatus,
          domain,
          keywords,
          country,
          language,
          limit,
          strategy,
          signature: runSignature,
          updatedAt: Date.now(),
        } satisfies StoredRun),
      );
    },
    [country, domain, keywords, language, limit, runSignature, strategy],
  );

  const calculateMetrics = useCallback((rows: ResultRow[]): QueryMetrics => {
    const found = rows.filter((row) => row.status === "found").length;
    const failed = rows.filter((row) => row.status === "fail").length;
    return {
      total: rows.length,
      found,
      failed,
      missed: rows.length - found - failed,
    };
  }, []);

  const runBatches = useCallback(
    async (startAt: number, seedResults: ResultRow[]) => {
      if (keys.length === 0) return;
      if (queryBlockReason) {
        setQueryError(queryBlockReason);
        return;
      }
      if (keywordList.length === 0) {
        setQueryError("keywords is required");
        return;
      }

      setIsQuerying(true);
      setQueryStatus("running");
      setQueryError(null);
      pauseRef.current = false;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      let accumulated = [...seedResults];
      setResults(accumulated);
      setCurrentPage(1);

      try {
        for (let i = startAt; i < keywordList.length; i += BATCH_SIZE) {
          if (pauseRef.current) {
            const progress = {
              processed: accumulated.length,
              total: keywordList.length,
            };
            const nextMetrics = calculateMetrics(accumulated);
            setQueryStatus("paused");
            setQueryProgress(progress);
            setMetrics(nextMetrics);
            persistRun(accumulated, nextMetrics, progress, "paused");
            return;
          }

          const batch = keywordList.slice(i, i + BATCH_SIZE);
          const res = await fetch("/api/keyword-ranking/batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              keys,
              strategy,
              domain,
              keywords: batch,
              country,
              language,
              limit,
              totalKeywords: keywordList.length,
              keyOffset: i,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Request failed (${res.status})`);
          }

          const data: { results: ResultRow[] } = await res.json();
          accumulated = [...accumulated, ...data.results];
          const progress = {
            processed: accumulated.length,
            total: keywordList.length,
          };
          const nextMetrics = calculateMetrics(accumulated);
          setResults(accumulated);
          setQueryProgress(progress);
          setMetrics(nextMetrics);
          persistRun(accumulated, nextMetrics, progress, "running");
        }

        const nextMetrics = calculateMetrics(accumulated);
        const nextStatus = nextMetrics.failed > 0 ? "partial" : "success";
        setMetrics(nextMetrics);
        setQueryStatus(nextStatus);
        setQueryProgress({
          processed: accumulated.length,
          total: keywordList.length,
        });
        persistRun(
          accumulated,
          nextMetrics,
          { processed: accumulated.length, total: keywordList.length },
          nextStatus,
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const nextMetrics = calculateMetrics(accumulated);
        const nextStatus = accumulated.length > 0 ? "partial" : "failed";
        const progress = {
          processed: accumulated.length,
          total: keywordList.length,
        };
        setMetrics(nextMetrics);
        setQueryStatus(nextStatus);
        setQueryProgress(progress);
        setQueryError(err instanceof Error ? err.message : "Unknown error");
        persistRun(accumulated, nextMetrics, progress, nextStatus);
      } finally {
        setIsQuerying(false);
      }
    },
    [
      calculateMetrics,
      country,
      domain,
      keys,
      keywordList,
      language,
      limit,
      persistRun,
      queryBlockReason,
      strategy,
    ],
  );

  const handleQueryStart = useCallback(async () => {
    setResults([]);
    setMetrics({ total: 0, found: 0, missed: 0, failed: 0 });
    setQueryProgress(null);
    await runBatches(0, []);
  }, [runBatches]);

  const handleQueryPause = useCallback(() => {
    pauseRef.current = true;
  }, []);

  const handleQueryResume = useCallback(async () => {
    const storedRun = loadStoredRun();
    if (storedRun?.signature !== runSignature) {
      setQueryError("Query settings changed. Start a new query instead.");
      return;
    }
    await runBatches(results.length, results);
  }, [results, runBatches, runSignature]);

  const handleRetryFailed = useCallback(async () => {
    const failedKeywords = results
      .filter((row) => row.status === "fail")
      .map((row) => row.keyword);
    if (failedKeywords.length === 0) return;
    const storedRun = loadStoredRun();
    if (storedRun?.signature !== runSignature) {
      setQueryError("Query settings changed. Start a new query instead.");
      return;
    }
    if (queryBlockReason) {
      setQueryError(queryBlockReason);
      return;
    }

    setIsQuerying(true);
    setQueryStatus("running");
    setQueryError(null);
    pauseRef.current = false;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let retried: ResultRow[] = [];
      for (let i = 0; i < failedKeywords.length; i += BATCH_SIZE) {
        const batch = failedKeywords.slice(i, i + BATCH_SIZE);
        const res = await fetch("/api/keyword-ranking/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keys,
            strategy,
            domain,
            keywords: batch,
            country,
            language,
            limit,
            totalKeywords: failedKeywords.length,
            keyOffset: i,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed (${res.status})`);
        }

        const data: { results: ResultRow[] } = await res.json();
        retried = [...retried, ...data.results];
      }

      const kept = results.filter((row) => row.status !== "fail");
      const nextResults = [...kept, ...retried];
      const nextMetrics = calculateMetrics(nextResults);
      const nextStatus = nextMetrics.failed > 0 ? "partial" : "success";
      setResults(nextResults);
      setMetrics(nextMetrics);
      setQueryStatus(nextStatus);
      setQueryProgress({
        processed: nextResults.length,
        total: nextResults.length,
      });
      persistRun(
        nextResults,
        nextMetrics,
        { processed: nextResults.length, total: nextResults.length },
        nextStatus,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setQueryError(err instanceof Error ? err.message : "Unknown error");
      setQueryStatus("partial");
    } finally {
      setIsQuerying(false);
    }
  }, [
    calculateMetrics,
    country,
    domain,
    keys,
    language,
    limit,
    persistRun,
    queryBlockReason,
    results,
    runSignature,
    strategy,
  ]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleExportWithKey = useCallback(async (): Promise<KeyHealthRow[]> => {
    if (keys.length === 0) return [];
    const controller = new AbortController();
    try {
      const res = await fetch("/api/keyword-ranking/key-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
        signal: controller.signal,
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return [];
      return [];
    }
  }, [keys]);

  return {
    // Form
    domain,
    keywords,
    country,
    language,
    limit,
    setDomain,
    setKeywords,
    setCountry,
    setLanguage,
    setLimit: handleLimitChange,
    // Drawer
    isDrawerOpen,
    setIsDrawerOpen,
    // Keys & strategy
    keys,
    strategy,
    handleStrategyChange,
    handleKeysChange,
    // Query
    results,
    paginatedResults,
    isQuerying,
    queryStatus,
    queryError,
    queryProgress,
    metrics,
    estimatedCalls,
    queryBlockReason,
    canResume,
    failedCount,
    handleQueryStart,
    handleQueryPause,
    handleQueryResume,
    handleRetryFailed,
    // Pagination
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    // Export
    handleExportWithKey,
  };
}
