# Phase 5: Keyword Clustering

Status: ready-for-agent
Type: task
Blocked by: 05

Implement `docs/specs/keyword-clustering.md`: Evidence procedure, URL normalization, compact Pair data, deterministic complete-link Web Worker, one Workspace, Domain Analysis, results, No Evidence/Failed, and CSV.

Validation: invariants, deterministic ties, 300+700 append case, worker behavior, storage recovery, and browser states.

## Comments

2026-09-01: Ready inputs for this phase: spec `docs/specs/keyword-clustering.md`; layout/style contract `docs/design/toolora/reference-ui-deconstruction.md` section 11 (flat section cards, form recipes, cluster-card recipe, pill semantics: No Evidence=neutral, Failed=red, Possible Cannibalization=yellow); locale dropdowns reuse `apps/web/src/features/serpapi-settings/locales.ts` + `data/`; Evidence fixed Top 10, no depth selector. ToolPageShell now renders children flat — clustering passes its own section cards. Outstanding wording task: resolve `location` vs country/region in spec and contracts (no city-level support).
