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

## Workspace

Store one versioned Workspace record in IndexedDB under the Tool slug.

- **添加到当前查询** fetches new keywords and preserves existing results.
- **开始新查询** confirms, offers export, then replaces the current Workspace.
- **刷新全部** re-runs all current keywords.
- deleting a keyword deletes its result.
- no Project list or history exists.
- closing the Tool page stops the Run.

When adding keywords, old results up to 24 hours old are reused. If any are older, the user chooses between fetching only new keywords and refreshing all. Never create an extra Toolora cache.

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
- paginated result table
- visible query timestamp
- failed-item retry action
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
- browser queue, pause, append, replace, 24-hour choice, and refresh recovery
- failed-queue integration with Key state
- CSV values, BOM, and formula safety
- Browser success/error/storage/theme/responsive states

## Acceptance

The Tool is complete when one through 1000 keywords can be queried through Web → oRPC → Hono → SerpAPI, resumed within one Workspace, exported safely, and fully exercised through automated seams and the in-app Browser.
