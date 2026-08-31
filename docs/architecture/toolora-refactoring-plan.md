# Toolora Architecture Refactoring Plan

Status: accepted design baseline
Date: 2026-08-30

## 1. Outcome

Toolora will be a Chinese-interface platform for independent browser-based Tools. The first two Tools are:

- `/keyword-ranking` — 关键词排名查询
- `/keyword-clustering` — 关键词聚类

Both use visitor-provided SerpAPI keys. Toolora has no accounts, project history, payments, database, or server-side user state. Next.js renders pages and SEO content; Hono/oRPC is the only Tool API; each Tool owns one browser-local Workspace.

The system grows by complete vertical slices. It does not begin with a plugin framework, dynamic Tool Registry, Provider Factory, or speculative packages.

## 2. Current project analysis

### New Better-T-Stack project

The new root project already provides a useful transport and UI foundation:

- Next.js 16 and React 19 in [`apps/web`](../../apps/web/)
- Hono Node server in [`apps/server`](../../apps/server/)
- oRPC client/server wiring in [`apps/web/src/utils/orpc.ts`](../../apps/web/src/utils/orpc.ts) and [`apps/server/src/index.ts`](../../apps/server/src/index.ts)
- shared environment validation in [`packages/env`](../../packages/env/)
- shared shadcn/ui primitives and tokens in [`packages/ui`](../../packages/ui/)
- Turborepo, Biome, Docker Compose, and shared TypeScript configuration

The only live business path is still a health check. There are no Tool modules, persisted contracts, business services, tests, accounts, or database. The scaffold is therefore a foundation, not an architecture to preserve unchanged.

### Old Toolora

The old Toolora is a Next.js-only application under [`docs/research/project/toolora`](../research/project/toolora/). Its proven product behavior includes:

- domain plus bulk keyword input
- country, search language, and Top 10–50 depth
- multiple SerpAPI keys with round-robin and sequential strategies
- pause, refresh recovery, failed-item retry, metrics, pagination, and CSV export
- key account status and quota visibility
- homepage catalog, search, categories, theme, metadata, sitemap, and robots

The implementation should not be copied. [`use-keyword-ranker.ts`](../research/project/toolora/hooks/use-keyword-ranker.ts) mixes form state, storage, queue scheduling, network requests, retries, pagination, and metrics. [`keyword-ranking-search.ts`](../research/project/toolora/lib/keyword-ranking-search.ts) mixes validation, SerpAPI transport, cache, key selection, domain matching, and result construction. Next Route Handlers also conflict with the accepted Hono-only Tool API.

### Old KeyPage

The old KeyPage under [`docs/research/project/keypage`](../research/project/keypage/) proves that SERP-overlap clustering, strict grouping, optional domain evidence, cancellation, and exports are viable. Its pure comparison and clustering tests are behavioral references.

It is not the target product. Multi-Project JSON storage, historical Snapshots, OpenSERP, configurable concurrency, Top 20/30, Pair Override, URL Map, automatic slug code, and the existing UI are removed. The replacement Tool is `keyword-clustering`, based on mature SERP-clustering behavior documented in [`docs/research/keyword-clustering-reference-analysis.md`](../research/keyword-clustering-reference-analysis.md).

## 3. Main problems to remove

- duplicated or transport-coupled types instead of one Zod contract source
- Tool business logic split between React components and Next Route Handlers
- large shallow files coordinating unrelated responsibilities
- server-side JSON Projects, Settings, and caches despite a browser-only product
- Provider and history abstractions that current requirements do not need
- mixed meanings for Not Found, No Evidence, and Failed
- inconsistent exact-host versus subdomain matching
- URL comparison polluted by tracking parameters and equivalent URL forms
- OpenAPI reference dependencies for an API that is not public
- chat-oriented UI components and starter metadata unrelated to Toolora
- incomplete typecheck/test tasks and a mutating `check` command
- broad `docs/` ignore rules that hide the architecture from future Agents

## 4. Capabilities to retain or rebuild

### Platform

- static Tool Manifest
- homepage search and category filters
- common Tool page shell
- Light, Dark, and System themes
- accessible loading, empty, validation, error, and destructive-confirmation states
- metadata, canonical URLs, sitemap, and robots

### Shared SerpAPI capability

- browser-local BYOK Key Pool
- round-robin and sequential batch selection
- Account API checks and per-account quota/rate status
- fixed-host, fixed-engine SerpAPI requests
- stable Toolora error codes
- request scheduling shared only after the second Tool proves the common shape

### Keyword Ranking

- up to 1000 normalized lowercase keywords
- exact Target Domain matching, ignoring only a leading `www.`
- Top 10–50 Search Depth
- Found, Not Found, and Failed outcomes
- browser-owned queue, pause, refresh recovery, failed queue, pagination, and CSV

### Keyword Clustering

- up to 1000 normalized lowercase keywords in one Analysis
- Top 10 normalized full-URL SERP Evidence
- Grouping Accuracy, default 4
- deterministic complete-link Agglomerative clustering
- Primary Keyword, Minimum Shared URL Pair, Singleton Cluster, No Evidence, and Failed
- optional exact-host Domain Analysis and Possible Cannibalization
- Card/Table presentation and one normalized CSV export

## 5. Capabilities deliberately omitted

- accounts, authentication, permissions, payments, quotas owned by Toolora
- server database, server Project history, background jobs, and multi-device state
- multilingual UI
- Toolora result cache beyond SerpAPI's cache
- OpenSERP and dynamic Provider selection
- OpenAPI Reference and public API promises
- Tool Definition fields for permissions, analytics, input/output modules, or server logic
- Topical Clusters, search intent, NLP, LLM classification, opportunity scores, and content generation
- CSV/XLSX upload for Keyword Clustering
- Target URL generation, URL Map, automatic slug generation, and Pair Override
- analytics and other unnecessary third-party browser scripts
- Schema.org, FAQ JSON-LD, and automatically generated SEO content

## 6. Target repository structure

```text
apps/
├── web/src/
│   ├── app/
│   │   ├── keyword-ranking/page.tsx
│   │   └── keyword-clustering/page.tsx
│   └── features/
│       ├── keyword-ranking/
│       ├── keyword-clustering/
│       └── serpapi-settings/
└── server/src/
    ├── integrations/serpapi/
    └── index.ts

packages/
├── api/src/
│   ├── contracts/
│   ├── procedures/
│   ├── context.ts
│   ├── errors.ts
│   └── router.ts
├── config/
├── env/
└── ui/

docs/
├── agents/
├── architecture/
├── specs/
├── domain/
├── adr/
├── design/
└── research/                 # ignored local evidence
```

No Tool package is created initially. A new package requires multiple workspace consumers, a stable deep interface, and an independent dependency/runtime/test boundary.

## 7. Next.js and Hono responsibilities

### Next.js

- routes, layouts, Tool Catalog, metadata, canonical, sitemap, and robots
- server-rendered Tool titles, descriptions, and help content
- client-side Tool Workspace, IndexedDB, forms, progress, result presentation, and CSV generation
- no Tool business requests through Server Actions or Next Route Handlers

### Hono/oRPC

- `healthCheck`
- `serpApi.checkKeys`
- `keywordRanking.runBatch`
- `keywordClustering.fetchBatch`
- trust-boundary validation, SerpAPI transport, response validation, and stable error mapping
- one Key per search request; no server session, Project, queue, or cache

The current `/rpc` prefix remains. Local development and current Docker Compose expose Web and Server separately. A same-origin reverse proxy is a deployment concern, not a prerequisite for development.

## 8. Tool architecture

The Tool Manifest is catalog metadata only:

```ts
type ToolCategory = "SEO 优化";

type ToolManifestItem = {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
};
```

Manifest tests enforce non-empty fields, unique lowercase kebab-case slugs, and allowed categories. Routes stay explicit. Each Tool is a vertical feature with its own page, Workspace model, UI, contracts, and tests.

The homepage keeps the old Toolora catalog shape: search by name/description, highlighted matches, category filters derived from the Manifest, Tool cards, and an Empty State.

## 9. Frontend architecture

The selected visual direction is recorded in [`docs/design/toolora/decision.md`](../design/toolora/decision.md). It remains minimal, uses the current Toolora/shadcn/ui language, and redesigns both Tools together.

Shared visual behavior includes:

- common Tool shell and SerpAPI Settings entry
- Light/Dark/System with progressive native theme transition and reduced-motion support
- confirmation dialogs for destructive Workspace replacement and storage recovery
- stable progress language across initial and failed-queue phases
- responsive and keyboard-accessible form, table, card, dialog, and settings interactions

Tool-specific forms and results remain in `apps/web`, not `packages/ui`.

## 10. Data, service, and API layers

### Browser storage

- SerpAPI Settings: `localStorage`
- one Workspace record per Tool: IndexedDB through `idb-keyval`
- Workspace keys are Tool slugs
- schema mismatch replaces the current Workspace after confirmation; no history migration
- starting a new Analysis deletes only the current Tool record

### Browser orchestration

- queue split into five-keyword batches
- at most ten concurrent batches
- immutable Run Config captured at Run start
- initial phase never retries
- failed queue retries after the initial phase
- quota/rate/invalid Key failures may advance through eligible accounts; other retry failures become final

### Server application

`packages/api` defines browser-safe contracts and server procedures. `apps/server` is the composition root and supplies a real `SerpApiClient` adapter. Raw SerpAPI payloads never cross the public interface.

## 11. Types and Schemas

- Zod input and output schemas are the API source of truth
- TypeScript types are inferred from schemas
- Web forms reuse the same browser-safe contract schemas
- external Search and Account responses are validated in the server adapter
- stable Toolora errors replace raw Provider messages
- API, form, service, and persisted types are not duplicated under different names

Cross-field Keyword Cluster invariants are defined in [`keyword-clustering.md`](../specs/keyword-clustering.md).

## 12. Migration order

1. formal docs and selected visual design
2. scaffold cleanup and reproducible local checks
3. Tool Manifest and shared page shell
4. SerpAPI Settings, Account checks, contracts, and adapter
5. Keyword Ranking vertical slices
6. extract the now-proven shared batch/Key orchestration
7. Keyword Clustering vertical slices
8. homepage catalog, SEO, theme transition, and responsive polish
9. Docker and browser acceptance

Old behavior is ported through tests and explicit requirements, not copied wholesale.

## 13. Phased delivery

### Phase 0 — Foundation

Remove OpenAPI and unrelated starter code, correct package dependencies, add read-only checks, typecheck every workspace, add Vitest tasks, create env examples, and verify the health path.

### Phase 1 — Design system and catalog

Select one of three visual directions, establish tokens and the Tool shell, add explicit Tool routes, and implement the Manifest-backed homepage.

### Phase 2 — SerpAPI capability

Implement browser settings, Key statuses, Account checks, server response validation, typed errors, and deterministic browser scheduling.

### Phase 3 — Keyword Ranking

Deliver one keyword/one Key first, then depth pagination, batches, Key strategies, Workspaces, failed queue, CSV, and all visible states.

### Phase 4 — Shared extraction

Compare the completed ranking flow with clustering requirements. Extract only the batch, Key, and error behavior that is genuinely identical.

### Phase 5 — Keyword Clustering

Deliver Evidence fetching, URL normalization, compact Pair data, Web Worker clustering, Domain Analysis, Workspace append/replace, results, and CSV.

### Phase 6 — Hardening

Finish SEO, theme transition, storage recovery, responsive behavior, Docker smoke, and browser acceptance across successful and failed states.

## 14. Risks and deliberate limits

- `localStorage` exposes BYOK keys to same-origin scripts; Toolora minimizes third-party scripts, never logs keys, and clearly offers removal.
- a 1000-keyword Analysis produces 499,500 Pairs; a compact triangular byte matrix and Web Worker keep browser memory and responsiveness bounded.
- Evidence appended after 24 hours may represent a different SERP moment; the user explicitly chooses reuse or full refresh.
- `429` is ambiguous; the Account API distinguishes exhausted quota from hourly throughput when possible.
- exact-host matching deliberately excludes subdomains.
- Possible Cannibalization is a warning derived from multiple matching URLs, not a confirmed SEO diagnosis.
- browser-only Runs stop when the Tool page closes; background completion is outside scope.
- the current dual-port Docker topology uses CORS; same-origin proxying is deferred to deployment.

## 15. First implementation priorities

The first code change should not be a full Tool framework. The first working tracer bullet is:

1. clean foundation commands and contracts
2. save/detect one SerpAPI Key safely
3. query one keyword through Web → oRPC → Hono → SerpAPI
4. render one deterministic Keyword Ranking result
5. leave one passing test at each public seam

Only after that slice works should batching, multiple Keys, Workspaces, and the second Tool be added.

## 16. Validation and Git boundary

Completion requires:

- `pnpm check`
- `pnpm check-types`
- `pnpm test`
- `pnpm build`
- WSL Docker Compose smoke
- in-app Browser validation of success, error, storage failure, pause/recovery, responsive, and theme states

No staging, commit, or push is part of this plan without separate authorization.
