"use client";

import { useCallback, useEffect, useState } from "react";

import { type KeyHealthRow } from "@/lib/keyword-ranking";

// Storage keys
const STORAGE_KEY = "toolora-kr-keys";
const STRATEGY_KEY = "toolora-kr-strategy";
const FORM_KEY = "toolora-kr-form";
const DRAWER_KEY = "toolora-kr-drawer";

// Default values (US / English — no domain/keywords defaults per spec)
const DEFAULT_COUNTRY = "US";
const DEFAULT_LANGUAGE = "en";
const DEFAULT_LIMIT = 25;

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

// Types
export interface ResultRow {
  keyword: string;
  rank: string;
  url: string;
  keyAlias: string;
  status: "found" | "miss" | "fail";
}

export interface QueryMetrics {
  total: number;
  found: number;
  missed: number;
  failed: number;
}

export interface QueryResponse {
  taskId: string;
  results: ResultRow[];
  metrics: QueryMetrics;
  status: "success" | "partial";
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
  isQuerying: boolean;
  queryStatus: "idle" | "success" | "partial";
  metrics: QueryMetrics;
  handleQueryStart: () => Promise<void>;

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
  const [limit, setLimit] = useState(stored?.limit ?? DEFAULT_LIMIT);

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
  const [queryStatus, setQueryStatus] = useState<
    "idle" | "success" | "partial"
  >("idle");
  const [metrics, setMetrics] = useState<QueryMetrics>({
    total: 0,
    found: 0,
    missed: 0,
    failed: 0,
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // After mount: restore persisted state (fixes H1 hydration mismatch)
  useEffect(() => {
    const stored2 = loadStoredForm();
    if (stored2) {
      setDomain(stored2.domain ?? "");
      setKeywords(stored2.keywords ?? "");
      setCountry(stored2.country ?? DEFAULT_COUNTRY);
      setLanguage(stored2.language ?? DEFAULT_LANGUAGE);
      setLimit(stored2.limit ?? DEFAULT_LIMIT);
    }
    setKeys(loadStoredKeys());
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
  }, []);

  const handleQueryStart = useCallback(async () => {
    if (keys.length === 0) return;
    setIsQuerying(true);
    setQueryStatus("idle");

    const controller = new AbortController();

    try {
      const keywordList = keywords
        .split("\n")
        .map((k) => k.trim())
        .filter(Boolean);

      const queryRes = await fetch("/api/keyword-ranking/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keys,
          strategy,
          domain,
          keywords: keywordList.join("\n"),
          country,
          language,
          limit,
        }),
        signal: controller.signal,
      });

      if (!queryRes.ok) throw new Error("Query failed");
      const queryData: QueryResponse = await queryRes.json();

      setResults(queryData.results);
      setMetrics(queryData.metrics);
      setQueryStatus(queryData.status);
      setCurrentPage(1);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    } finally {
      setIsQuerying(false);
    }
  }, [keys, strategy, domain, keywords, country, language, limit]);

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
    setLimit,
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
    isQuerying,
    queryStatus,
    metrics,
    handleQueryStart,
    // Pagination
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    // Export
    handleExportWithKey,
  };
}
