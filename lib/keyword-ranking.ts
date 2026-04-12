// Query request from browser
export interface QueryRequest {
  keys: string[];
  strategy: "roundRobin" | "sequential";
  domain: string;
  keywords: string;
  country: string;
  language: string;
  limit: number;
}

// Result row shown in table
export interface ResultRow {
  keyword: string;
  rank: string;
  url: string;
  keyAlias: string;
  status: "found" | "miss" | "fail";
}

// Key health from SerpAPI Account API
export interface KeyHealthRow {
  alias: string;
  remaining: number;
  total: number;
  plan: string;
  rateUsed: number;
  rateLimit: number;
  status: "active" | "rate_limited" | "exhausted";
}

// Mask a key for display (e.g., sk_live_•••••A13)
export function maskKey(key: string): string {
  if (key.length <= 8) return key.slice(0, 3) + "••••••";
  return key.slice(0, 7) + "••••••" + key.slice(-3);
}

// Derive status from SerpAPI Account data
export function deriveKeyStatus(
  remaining: number,
  rateUsed: number,
  rateLimit: number,
): KeyHealthRow["status"] {
  if (remaining === 0) return "exhausted";
  if (rateUsed >= rateLimit) return "rate_limited";
  return "active";
}
