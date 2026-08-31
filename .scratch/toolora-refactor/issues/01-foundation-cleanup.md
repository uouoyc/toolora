# Phase 0: Foundation cleanup

Status: resolved
Type: task

## Scope

- remove accepted OpenAPI, duplicate dependency, starter metadata, Bun compile, and chat-component paths
- keep Env/Zod dependencies required by contracts and Provider response validation
- separate the Hono app from process startup and retain `/` health behavior
- add one public-seam Hono health test through `app.request()`
- make `check` read-only, add `fix` and Turbo `test`, and typecheck every TypeScript workspace
- use JIT source packages with `tsc --noEmit`; Next and tsdown remain builders
- add Web/Server `.env.example`

## Validation

- focused Hono health test
- `pnpm check`
- `pnpm check-types`
- `pnpm test`
- `pnpm build`
- `git diff --check`

## Boundary

Do not implement Tool features or redesign production UI in this phase.

## Answer

Completed the accepted foundation cleanup:

- separated the importable Hono app from Node process startup
- removed OpenAPI and duplicate dependency paths while retaining Env/Zod and the required shadcn CSS dependency
- removed unrelated chat primitives, unused Loader, Bun compile, and Better-T-Stack metadata
- added pnpm lockfile, Vitest health seam, workspace typecheck tasks, read-only Biome check/fix, Turbo test, and env examples
- migrated Biome configuration and aligned existing two-space formatting

Validation passed: `pnpm check`, `pnpm check-types`, `pnpm test`, `pnpm build`, and `git diff --check`. Hono's supported `app.request()` seam is covered; no extra CLI dependency was added.
