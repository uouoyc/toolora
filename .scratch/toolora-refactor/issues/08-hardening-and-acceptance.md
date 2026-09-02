# Phase 7: Hardening and acceptance

Status: resolved
Type: task
Blocked by: 07

Run full checks, WSL Docker Compose smoke, and in-app Browser E2E for success, Provider errors, storage failures, pause/recovery, refresh recovery, Light/Dark/System, and responsive layouts. Capture accepted screenshots and report remaining limits.

No Git staging, commit, or push without separate authorization.

## Comments

2026-09-02: Resolved and committed on `main` (not pushed):

- `93c14e2` build: pass site url build arg through web image and compose
- `684463e` build: prune server runner image to deployed dist and prod deps
- `bdd469a` fix: switch react compiler to rust port to unblock linux builds
- `74ee020` fix: prevent mobile overflow from tables and pagination
- `a30a6ae` docs: note docker buildx prerequisite and baked public args in readme
- `2f8e1bc` docs: record phase 7 hardening and acceptance evidence

Delivered: the three known Docker gaps closed — web image takes `NEXT_PUBLIC_SITE_URL` as a build arg (compose default `http://localhost:3001`, root `.env` overridable, no hardcoded production domain), server runner is a `pnpm deploy --prod --legacy` directory (dist + production deps only, 377 MB vs the 1.65 GB builder stage, no `.env` in any image layer), and compose passes the build args. The container web build previously panicked Turbopack on Linux with the Babel-run React Compiler (`conflicting effects for the same key`, bisected in-container); it now uses the native `turbopackRustReactCompiler` port — same feature, builds on all platforms. Responsive acceptance found a real 375px page-level overflow (74px) from result tables and pagination stretching flex ancestors; fixed with `min-w-0` on SectionCard + the three table scroll wrappers and `flex-wrap` on the pagination controls row (page width back to viewport, tables scroll in-container). WSL engine needed the `docker-buildx` plugin (Arch `pacman -S docker-buildx`, now noted in README); both healthchecks green on `docker compose up`, sitemap/robots/canonical correctly baked. Serial validation green throughout: `pnpm check` (zero diagnostics) / `check-types` / `test` (server 23 / web 90) / `build` (8 routes) / `git diff --check`. Browser E2E ran against the containerized web through a same-origin proxy plus a fake oRPC stub (no real SerpAPI query, no real key; one early fake-key checkKeys request was rejected by zod input validation inside the container — it never reached the provider, per server logs) and covered: ranking success 8/8, Provider errors (single-key INVALID_KEY terminal state + three-key PROVIDER_UNAVAILABLE rotation with manual 重试失败项 recovery), storage failure (both dialog branches), pause/resume at 50/55 → 55/55, refresh recovery from IndexedDB, clustering success (CLUSTER 1/2/3), light/dark/system theme triad with 0 view transitions under reduced motion, 375/768/1280 breakpoints, and keyboard focus semantics (native focusables, Tab advance, `:focus-visible` 4px ring). Evidence: `docs/design/toolora/design-qa.md` (Phase 7 section) + 9 captures under `docs/design/toolora/qa/*phase7*`. Remaining limits: `pnpm deploy --legacy` and `turbopackRustReactCompiler` are experimental-flagged; OS color-scheme flip and physical-keyboard submission were not demonstrable in the IAB (no colorScheme emulation, unreliable synthetic-event injection); the two tools' table wrapper markup remains duplicated (future shared-recipe extraction). Phase 7 closes the toolora-refactor effort: issues 01–08 all resolved.

