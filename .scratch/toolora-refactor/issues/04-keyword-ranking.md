# Phase 3: Keyword Ranking

Status: resolved
Type: task
Blocked by: 03

Implement `docs/specs/keyword-ranking.md` one vertical slice at a time: one keyword/Key, depth pagination, five-keyword batches, Workspace append/replace/refresh, pause/recovery, failed queue, results, and CSV.

Validation: public contract, domain matching, queue/Workspace tests, browser states, and build.

## Comments

2026-09-01: Resolved and committed on `main` (not pushed):

- `707065b` feat: add keyword ranking api contracts and serpapi integration
- `7fa5f49` feat: add keyword ranking tool with direct query ux
- `84faa43` docs: sync keyword ranking specs and add ui reference deconstruction

Scope evolved past the original ticket text after user confirmation (handoff: see Temp `toolora-keyword-ranking-ux-locale-handoff.md`): direct-query UX replaced append/replace/refresh and the 24-hour flow; stable browser-private `keyword -> keyId` affinity added; country/language dropdowns consume the official SerpAPI locale snapshots in `apps/web/src/features/serpapi-settings/data/`. Current source of truth: `docs/specs/keyword-ranking.md` and `docs/design/toolora/flows.md` section 3. Evidence: web 25/25 + server 6/6 tests, two-axis code review, browser QA (light/dark/mobile, no live Key usage).
