# Keyword Ranking Specification

## Product

- Slug: `keyword-ranking`
- Chinese name: 关键词排名查询
- Purpose: find the highest organic rank of one exact Target Domain for each supplied keyword
- UI language: Chinese; search country/language are independent query settings

## Input

```ts
type KeywordRankingInput = {
  targetDomain: string;
  keywords: string[];
  country: string;
  language: string;
  searchDepth: 10 | 20 | 30 | 40 | 50;
};
```

Normalize keywords by trimming, Unicode NFC, collapsing whitespace, lowercasing, removing empty values, and case-insensitive deduplication while preserving first input order. Limit the Workspace to 1000 normalized keywords.

Normalize Target Domain from a hostname or HTTP/HTTPS URL. Ignore path/query/fragment and a leading `www.`. Match only the exact normalized hostname; `blog.example.com` does not match `example.com`.

Country and language come from the official SerpAPI locale snapshots owned by SerpAPI Settings ([`serpapi-settings.md`](./serpapi-settings.md)). The dropdowns offer snapshot members only; form validation requires exact snapshot membership, and valid codes include multi-part languages such as `zh-cn` and `es-419`. The shared contract validates only the transport shape (two lowercase segments at most).

## Workspace

Store one versioned Workspace record in IndexedDB under the Tool slug.

- The keyword textarea is the single source of truth. Every click on 开始查询 runs **all current textarea keywords** with the current target domain, country, language, and depth.
- Each run immediately clears prior results, syncs the Workspace to the textarea (removed keywords disappear from the Workspace and result table), and keeps `keyword -> keyId` affinity for keywords that remain. The result table has no per-row delete control.
- 开始查询 is disabled while the form is incomplete, no Key is saved, or a Run is in progress. Once at least one Key is saved, clicking Start runs automatic Key health checking and then the query; no pre-run confirmation exists.
- deleting a keyword from the textarea and re-running removes its result.
- no Project list or history exists.
- closing the Tool page stops the Run.

There is no append/new-query choice and no 24-hour reuse decision; those flows are intentionally removed. Only the Workspace storage-failure recovery Dialog remains.

## Stable Key assignment

- The Workspace stores browser-private `keyword -> keyId`; it never crosses the public API boundary, results, or CSV.
- Found and Not Found outcomes bind the keyword to the Key that completed it; Failed never binds.
- Affinity has no TTL: it survives target-domain, country, language, and depth changes as long as the keyword stays in the textarea.
- Existing bindings override Round Robin/Sequential selection; new or unbound keywords use the selected strategy.
- A missing or ineligible bound Key falls back to an eligible Key; a successful fallback rebinds the keyword.
- Only INVALID_KEY, KEY_FORBIDDEN, QUOTA_EXHAUSTED, and RATE_LIMITED rotate Keys. Network, timeout, 5xx, and unknown Provider failures do not.
- Keywords are grouped by assigned Key, then split into browser batches of at most five. Original textarea order is preserved in results.
- Schema is version 2 with no migration path; incompatible data is replaced.

## Run

- Browser owns the queue, pause, recovery, failed queue, pagination state, and IndexedDB writes.
- Split initial work into five-keyword batches, at most ten concurrent.
- Capture an immutable Run Config at start.
- The initial phase never retries.
- Pause stops scheduling new batches; already-started requests settle.
- Refresh restores completed/pending/failed states and resumes only after user action.
- The failed queue follows [`serpapi-settings.md`](./serpapi-settings.md).

## Server procedure

`keywordRanking.runBatch` accepts at most five keywords, one Key, exact query parameters, and fixed `google_light` Engine semantics.

For each keyword:

1. request organic results ten at a time
2. calculate absolute rank across pages
3. match the exact Target Domain, ignoring only leading `www.`
4. stop after the highest match
5. stop after Search Depth when absent
6. validate every Provider response before use

The response contains Toolora results and errors, never raw SerpAPI payloads or full Keys.

## Result

```ts
type KeywordRankingStatus = "found" | "not-found" | "failed";

type KeywordRankingResult = {
  keyword: string;
  status: KeywordRankingStatus;
  rank: number | null;
  url: string | null;
  errorCode: TooloraErrorCode | null;
  fetchedAt: string | null;
};
```

Invariants:

- Found has non-null rank, URL, and fetchedAt; errorCode is null.
- Not Found has null rank/URL, non-null fetchedAt, and null errorCode.
- Failed has null rank/URL and a non-null stable errorCode.
- Not Found is a successful search outcome and never enters the failed queue.

## Result presentation

- totals for Found, Not Found, and Failed
- progress for initial and failed-queue phases
- paginated result table with a persistent footer (rows-per-page and page numbers; default ten rows)
- failed-item retry action (header and per-row for Failed rows); no per-row delete
- no `查询时间` table column; `fetchedAt` stays in persisted data and CSV
- CSV export

The selected visual structure is defined later in `docs/design/toolora/`.

## CSV

```text
keyword
status
rank
url
error_code
country
language
search_depth
fetched_at
```

Use UTF-8 BOM and prevent spreadsheet-formula injection. Do not export Keys, Key aliases, Account information, or raw Provider errors.

## Storage failure

If saving the Workspace fails, keep the Run/results in memory and show a Dialog:

- continue without saving
- delete only the prior Keyword Ranking Workspace and retry

If still unsaved, show persistent state that refreshing loses current progress.

## Test seams

- keyword and exact-host normalization
- absolute rank and early-stop behavior
- Found/Not Found/Failed invariants
- five-keyword procedure validation
- browser queue, pause, direct-run textarea sync, and refresh recovery
- stable Key affinity across settings changes, fallback rebinding, and Key-only rotation
- failed-queue integration with Key state
- CSV values, BOM, and formula safety
- Browser success/error/storage/theme/responsive states

## Acceptance

The Tool is complete when one through 1000 keywords can be queried through Web → oRPC → Hono → SerpAPI, resumed within one Workspace, exported safely, and fully exercised through automated seams and the in-app Browser.
