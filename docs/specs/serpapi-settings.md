# SerpAPI Settings Specification

## Purpose

SerpAPI Settings is the shared browser-local BYOK configuration for SerpAPI-backed Tools. It owns Key entry, Account checks, status display, batch Key selection, and the official SerpAPI locale snapshots. It does not own Tool inputs, results, Workspaces, or server state.

## Locale data

Both snapshots are committed once and never fetched at runtime:

```text
apps/web/src/features/serpapi-settings/data/
├── serpapi-countries.json   # official `gl` entries: country_code / country_name
└── serpapi-languages.json   # official `hl` entries: language_code / language_name
```

- The country dropdown offers the complete official list; the language dropdown offers the curated snapshot, which excludes `xx-*` placeholder locales.
- Provider codes are lowercase and may be multi-part (`zh-cn`, `pt-br`, `pt-pt`, `sr-me`, `es-419`).
- Tool UIs validate country/language by exact snapshot membership; the shared contracts validate only the transport shape (at most two lowercase segments) so Key and Tool contracts stay snapshot-agnostic.
- Ranking and future Clustering reuse the same dropdown data from this feature; Clustering fixes Evidence at Top 10 and exposes no depth selector.

## Storage

Store one versioned settings object in `localStorage`:

```ts
type KeyStatus =
  | "unchecked"
  | "active"
  | "invalid"
  | "forbidden"
  | "quota-exhausted"
  | "rate-limited"
  | "unknown";

type SerpApiKeyEntry = {
  id: string;
  secret: string;
  status: KeyStatus;
  accountId: string | null;
  searchesLeft: number | null;
  hourlyUsed: number | null;
  hourlyLimit: number | null;
  monthlyLimit: number | null;
  planName: string | null;
  checkedAt: string | null;
};

type SerpApiSettings = {
  schemaVersion: 1;
  strategy: "round-robin" | "sequential";
  keys: SerpApiKeyEntry[];
};
```

- `id` is generated with `crypto.randomUUID()` when a unique Key is saved.
- Key secrets are trimmed, empty values removed, and exact duplicates removed while preserving order.
- No product count limit exists. `localStorage` and request-body limits remain trust boundaries.
- Full secrets never enter IndexedDB, CSV, logs, URLs, error messages, or result models. Do not include them in screenshots.
- The Key Pool textarea keeps saved Keys editable for the current browser user; the Key status table shows only masked values.

## Save failure

If `localStorage` write fails, retain the edited settings in memory and show a confirmation Dialog:

- **仅本次使用，不保存** — continue with the in-memory settings
- **删除此前保存的 SerpAPI Key 并重试** — remove only the SerpAPI Settings key and retry

If the retry fails, continue in memory and show an unsaved state. Never call `localStorage.clear()`.

## Account checks

`serpApi.checkKeys` accepts Key `{ id, secret }` pairs and returns results keyed by `id`. Hono calls SerpAPI Account API with at most ten concurrent requests.

- Call automatically before every Run.
- Keep a **检测全部 Key** action in Settings.
- Group Keys with the same returned `accountId`; they share quota/rate status.
- `searchesLeft > 0` and `hourlyUsed < hourlyLimit` → `active`
- no searches left → `quota-exhausted`
- hourly limit reached → `rate-limited`
- 401 → `invalid`
- 403 → `forbidden`
- Account API unavailable → `unknown`

Run eligibility order is `active`, then `unknown`. Other states do not participate. Block Run start only when no eligible Key exists.

Account values are snapshots. `checkedAt` remains stored for freshness-sensitive flows but is not a default Key Health table column. Key Health appears only after at least one Key has a snapshot. Successful searches do not decrement a local balance because SerpAPI cache hits may be free.

## Batch selection

- One browser batch contains at most five keywords.
- At most ten batches run concurrently.
- Round-robin assigns successive initial batches to successive eligible accounts/Keys.
- Sequential assigns initial batches to the current eligible Key until it becomes unavailable.
- One Key is sent per Hono search request.
- A Run captures an immutable settings snapshot; settings edits apply to the next Run.

## Failure queue

The initial phase never retries. Every failed keyword records its Key ID, Toolora error, HTTP status, and attempted Key IDs.

After all initial batches settle:

1. regroup failed keywords into batches of at most five
2. select an eligible Key not yet attempted for that keyword
3. make one retry request
4. rotate again only for Key-specific unusable states: invalid, forbidden, exhausted quota, or hourly rate limit
5. stop on network, timeout, 5xx, validation, or other Provider errors
6. never use the same Key twice for the same failed keyword
7. stop the queue when no eligible account remains

On HTTP 429, Hono calls Account API once for that Key when possible and maps the result to `QUOTA_EXHAUSTED` or `RATE_LIMITED`. An unusable account is skipped globally by later queue items.

## Public errors

```text
VALIDATION_ERROR
INVALID_KEY
KEY_FORBIDDEN
RATE_LIMITED
QUOTA_EXHAUSTED
PROVIDER_UNAVAILABLE
REQUEST_TIMEOUT
UNKNOWN_PROVIDER_ERROR
```

Raw Provider messages remain server-side and are sanitized before logging.

## Security requirements

- Search Keys travel only in browser-to-Hono JSON POST bodies. SerpAPI's Account API requires the Key as the server adapter's fixed-host `api_key` query parameter; that outbound Provider exception is never logged, returned, or exposed in a browser/Toolora URL.
- Server procedures fix the SerpAPI host and validate the Tool-specific Engine.
- Hono applies request-body limits and strict Zod input/output validation.
- Logs contain request ID, procedure, Toolora code, status, and duration only.
- Toolora loads no Analytics or other unnecessary third-party browser scripts.

## Test seams

- settings normalization and masking
- storage success, quota failure, recovery choice, and memory-only mode
- Account response classification and same-account grouping
- round-robin and sequential selection
- immutable Run Config
- failed-queue Key traversal and termination
- Hono `checkKeys` procedure and stable errors
- Browser Settings states, dialogs, and Key status table

## Acceptance

The feature is complete when a visitor can save, mask, remove, detect, and use multiple Keys; begin a Run with only eligible Keys; understand quota/rate state; recover from storage failure; and never expose a full Key outside the expected request body.
