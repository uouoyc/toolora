# Phase 5: Keyword Clustering

Status: resolved
Type: task
Blocked by: 05

Implement `docs/specs/keyword-clustering.md`: Evidence procedure, URL normalization, compact Pair data, deterministic complete-link Web Worker, one Workspace, Domain Analysis, results, No Evidence/Failed, and CSV.

Validation: invariants, deterministic ties, 300+700 append case, worker behavior, storage recovery, and browser states.

## Comments

2026-09-01: Ready inputs for this phase: spec `docs/specs/keyword-clustering.md`; layout/style contract `docs/design/toolora/reference-ui-deconstruction.md` section 11 (flat section cards, form recipes, cluster-card recipe, pill semantics: No Evidence=neutral, Failed=red, Possible Cannibalization=yellow); locale dropdowns reuse `apps/web/src/features/serpapi-settings/locales.ts` + `data/`; Evidence fixed Top 10, no depth selector. ToolPageShell now renders children flat — clustering passes its own section cards. Outstanding wording task: resolve `location` vs country/region in spec and contracts (no city-level support).

2026-09-02: Resolved and committed on `main` (not pushed):

- `c521e84` refactor: extract shared keyword contracts and csv helpers
- `70353ed` feat: add keyword clustering api contracts and serpapi evidence adapter
- `bc3cdbd` feat: add keyword clustering core with web worker and workspace
- `46effef` refactor: extract shared tool ui recipes from ranking
- `1ae9a38` feat: add keyword clustering tool page with results ui
- `f98d99f` docs: align keyword clustering spec and flows with implementation

Delivered per `docs/specs/keyword-clustering.md` (spec synced in the same batch): `keywordClustering.fetchBatch` fixed Top 10 `google_light` Evidence as raw URL + page identity pairs (identity = host + normalized path; query/fragment/scheme/port/www/index-documents dropped; dedup by identity first-wins); evidence-ready/no-evidence/failed union on the shared runner seams (`createKeywordRunner`, `planKeywordBatches`, key affinity, `settingsForRun`); deterministic complete-link clustering in a real Web Worker (triangular Uint8Array, lazy max-heap merges, all seven invariants and tie-break rules); one schemaVersion-2 idb-keyval Workspace with storage-failure recovery; direct-query UX mirroring ranking (single 开始分析, textarea is truth, no append/24h/replace dialogs, keyword deletion from results behind one confirmation with local re-cluster); Cluster-first results (cards + one-row-per-Cluster table with member summary/expansion, 搜索结果 n/10 drill-down linking identity text to raw URL, 目标网站匹配 column with 可能页面竞争 warning); two exports (聚类结果 CSV default + 关键词明细 CSV) with UTF-8 BOM and formula protection. Validation: `pnpm check` (zero diagnostics) / `check-types` / `test` (server 23 / web 80) / `build` / `git diff --check` all green; two-axis code review findings fixed (singleton mislabel, double-fetch of failed keywords on append, duplicate cluster error banner, stale CSV export, missing member drill-down, recipe duplication); browser QA on localhost:3001 covered empty/result/running/theme/390px plus a live identity-dedup case (same landing page via gad vs utm params clustered correctly) and refresh-restore. User-sanctioned spec deltas: `country` wording (was `location`), array-order SERP ranking, URL identity replaces the tracking-param blocklist, cluster-first presentation and dual CSV schemas, direct-query start UX.
