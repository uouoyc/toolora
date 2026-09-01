# Phase 4: Extract proven shared orchestration

Status: resolved
Type: task
Blocked by: 04

Compare completed Keyword Ranking behavior with Keyword Clustering needs. Extract only identical batch, Key, and stable-error behavior within the existing Web/Server workspaces. Do not create a new package unless the documented package gate is satisfied.

Validation: ranking behavior remains unchanged and tests cross the same public seams.

## Comments

2026-09-01: Timing guidance recorded in `docs/design/toolora/reference-ui-deconstruction.md` section 11.4 — extract shared recipes (SectionCard, Field, Microlabel, StatusPill, DataTableHead, Banner, Pagination) when Keyword Clustering becomes the second consumer; keep single-use components inside the clustering feature. Placement per `docs/agents/tool-development.md`: shared tool-shaped UI stays in `apps/web`, not `packages/ui`.

2026-09-01 (clarification): Scope is the orchestration layer only — batch splitting/concurrency, Key affinity and rotation, failed-queue traversal, stable error codes, and the oRPC procedure pattern — all pinned by the clustering spec, so this is not speculative. The UI recipe list in deconstruction §11.4 (SectionCard, StatusPill, Banner, Pagination, ...) stays OUT of this ticket and extracts lazily during 06 when clustering's UI shape is real. 06 remains blocked by this ticket.

2026-09-01: Resolved and committed on `main` (not pushed):

- `8f8a3d7` refactor: extract shared keyword run orchestration in web
- `8c2c970` refactor: extract shared tool workspace storage recovery
- `5c6e826` refactor: extract shared serpapi run settings check
- `4300a9b` refactor: extract shared serpapi error mapping and google light url

Extracted seams: `apps/web/src/lib/keyword-run/` (types, batches with five-keyword split + plan + retry batches, key-affinity bind/prune, generic `createKeywordRunner` with ≤10 concurrency, four-ErrorCode rotation, failed-queue traversal/termination, account-cascade status updates); `apps/web/src/lib/workspace-storage.ts` (idb-keyval workspace record + save/del-retry recovery); `apps/web/src/features/serpapi-settings/run-settings.ts` (`settingsForRun` health-check + eligibility, Chinese error strings verbatim); `apps/server/src/integrations/serpapi/errors.ts` + `google-light.ts` (stable HTTP→Toolora error mapping incl. 429 recheck disambiguation, timeout mapping, fixed engine URL builder). Ranking feature modules keep identical export names/signatures as thin typed facades, so all 25 pre-existing web tests and 6 server tests pass unmodified (zero-change evidence); new shared-seam tests bring the totals to web 46 / server 12. Not extracted (documented decisions): `SERP_API_SETTINGS_CHANGED_EVENT` was already shared with two consumers in `serpapi-settings/settings.ts`; the oRPC procedure pattern stays per-tool declarative wiring in `packages/api` (no second consumer yet; packages/api untouched to keep the public API byte-identical). UI recipes intentionally deferred to 06 per §11.4. Validation: `pnpm check` / `check-types` / `test` / `build` / `git diff --check` all green; two-axis code review (Standards: no hard violations; Spec: no missing/wrong items, zero behavior drift confirmed against the zod discriminated union) with follow-up fixes applied; no-network browser smoke on the production build confirmed page load, locale dropdowns, Run Hint, and disabled 开始查询. 06 is unblocked.
