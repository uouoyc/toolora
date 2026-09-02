# Toolora Design QA

Scope: Phase 1 Tool shell, Manifest, and Homepage Catalog; Phase 6 catalog polish, SEO shell, and theme revalidation; Phase 7 hardening and acceptance (Docker, E2E matrix).

## Phase 7 Evidence (2026-09-02)

- Validation baseline held green throughout: `pnpm check` (zero diagnostics) / `check-types` / `test` (server 23 / web 90) / `build` (8 routes incl. robots.txt + sitemap.xml) / `git diff --check`.
- Docker Compose smoke (WSL Docker Engine, buildx plugin installed): both containers build and pass their healthchecks; `NEXT_PUBLIC_SITE_URL` is now a web build arg (compose default `http://localhost:3001`, root `.env` overridable — no hardcoded production domain); server runner pruned from a full-monorepo copy to a `pnpm deploy --prod --legacy` directory (dist + production deps, 377 MB vs 1.65 GB builder stage); no `.env` inside either image.
- Container-build fix: the Babel-run React Compiler panicked Turbopack on Linux (`conflicting effects for the same key`, bisected in-container); `experimental.turbopackRustReactCompiler` switches to the native Rust port — same feature, all platforms build.
- Responsive fix: 375px page-level horizontal overflow (74px, 449px scroll width) came from result tables and the pagination controls stretching flex ancestors; `min-w-0` on SectionCard + the three table scroll wrappers, plus `flex-wrap` on the pagination controls row, restore in-container table scrolling (page width 360px at 375 viewport, zero page overflow).
- Browser E2E (containerized web via same-origin proxy + fake oRPC stub; no real SerpAPI query, no real key): ranking success 8/8 (found 5 / not-found 3 / failed 0), Provider errors (single-key INVALID_KEY terminal state with per-row retry affordances; three-key pool with per-keyword PROVIDER_UNAVAILABLE auto-rotates two keys then manual 重试失败项 resolves via the third, failures clear to 0), storage failure (IndexedDB write throws → 无法保存当前工作区 dialog; 继续但不保存 keeps live data with the unsaved banner, 删除此前工作区并重试 recovers and clears it), pause/resume (55-keyword run pauses at 50/55 with 继续查询, resumes to 55/55), refresh recovery (workspace, form, results, and metrics fully restore from IndexedDB), clustering success (6 keywords → CLUSTER 1/2/3 with card/table views, pagination, CSV).
- Theme triad: explicit light/dark via `theme` storage (html class + body background contrast), toggle dark↔light verified twice, and no stored choice follows System (html class matches the real OS preference); reduced-motion path verified with a patched `matchMedia` — theme toggle performs 0 view transitions under `prefers-reduced-motion: reduce` while still switching.
- Keyboard: all 19 interactive elements on the Tool page are native focusables (no fake controls), real Tab advances wordmark → theme toggle, and inputs carry a `:focus-visible` 4px ring; the IAB's synthetic key/click injection is unreliable, so form submission was verified through the same submit-event path a keyboard Enter takes.
- Browser captures: `qa/ranking-phase7-success.png`, `qa/ranking-phase7-provider-error.png`, `qa/ranking-phase7-storage-failure-dialog.png`, `qa/ranking-phase7-paused.png`, `qa/ranking-phase7-refresh-recovery.png`, `qa/clustering-phase7-success.png`, `qa/theme-phase7-light.png`, `qa/theme-phase7-dark.png`, `qa/ranking-phase7-mobile-375.png`.
- Remaining limits: `pnpm deploy --legacy` is experimental-flagged in pnpm 11.22; `turbopackRustReactCompiler` is experimental; OS color-scheme flip and full physical-keyboard submission were not demonstrable in the IAB (no colorScheme emulation; unreliable event injection); the two tools' table wrapper markup remains duplicated (shared-recipe extraction left as future polish).

## Phase 6 Evidence (2026-09-02)

- Live search interaction adopted per original Toolora behavior: filtering and highlighting update while typing; the 搜索 button focuses the input.
- Catalog fidelity: search row uses the §3.11 recipes (command hint `hidden md:flex` + `bg-background/50`, input `min-h-13 bg-background/80` + focus `ring-4 ring-primary/10`, equal-height stretch cells at 18px radius); category rail is `lg:sticky` with a `shadow-lg shadow-primary/20` active indicator and `99+`-capped two-digit counts; tool cards use the hover 四件套 with `group-hover:text-primary` titles, `rounded-4xl` tag badges, and an h-8 full-width CTA; the empty state is `min-h-60 border-dashed`.
- Browser captures: `qa/home-phase6-desktop-light.png`, `qa/home-phase6-desktop-dark.png`, `qa/home-phase6-mobile-light.png`, `qa/ranking-phase6-pagination-mobile.png`.
- Measured (desktop 1280): search cells equal height (92px stretch), radii 18px uniform, icon inset 16px, active category shadow `shadow-lg shadow-primary/20`, badge 20px/26px radius, card radius 22px, card CTA 32px, no horizontal overflow. 375/768/1024 breakpoint behaviors match §6 (hint hidden→1 card column at 375; 3-col search + 2 columns at 768; sticky rail at 1024; 3 columns at 1280).
- Responsive fix: shared Pagination now stacks below 768 (`flex-col` → `md:flex-row`), restoring the §3.9 recipe; keyword-ranking measured 36px horizontal overflow at 375 before the fix and 0 after, keyword-clustering 0.
- Theme: Light↔Dark toggle drives the circular View Transition reveal (spy-verified `startViewTransition` with `--x/--y`), falls back to an immediate switch under emulated `prefers-reduced-motion: reduce` (no view transition), and follows System when no stored choice exists; both tool pages and the homepage keep zero overflow in dark.
- Keyboard: `Ctrl+K` focuses search; tab order is wordmark → theme toggle → search input → 搜索 → categories → card CTAs; primitives keep `focus-visible` rings; category slide and indicator animations are `motion-reduce` guarded.

## Phase 1 Evidence

- Source visual truth: `docs/design/toolora/options/homepage-catalog-reference.png`
- Browser-rendered implementation: `docs/design/toolora/qa/home-phase1-final.png`
- Browser-comment revision: `docs/design/toolora/qa/home-phase1-revised.png`
- Tool-shell revision: `docs/design/toolora/qa/tool-shell-phase1-revised.png`
- Full-view comparison: `docs/design/toolora/qa/home-phase1-comparison.png`
- Focused content comparison: `docs/design/toolora/qa/home-phase1-focus-comparison.png`
- Mobile Dark state: `docs/design/toolora/qa/home-phase1-mobile-dark.png`
- Desktop viewport and CSS size: 2237 × 1309 px
- Source pixels: 2237 × 1309 px
- Implementation pixels: 2237 × 1309 px
- Device scale factor: browser default; both comparison halves use their native pixels with no resampling
- State: Chinese Homepage Catalog, Light theme, no query, all categories

## Findings

No actionable P0, P1, or P2 differences remain in the Phase 1 scope.

- Fonts and typography: Geist preserves the restrained sans-serif hierarchy; Chinese fallback renders cleanly with comparable weights and line lengths.
- Spacing and layout rhythm: the centered shell, large search frame, category rail, catalog heading, rounded cards, and generous whitespace follow the reference. The second card is an intentional product difference because Toolora now exposes two Tools.
- Colors and visual tokens: neutral Light and Dark palettes, thin borders, muted labels, and black primary actions match the selected direction.
- Image quality and assets: this surface has no raster imagery or custom brand illustration. Standard UI symbols come from the installed icon library; no placeholder or handcrafted SVG asset is present.
- Copy and content: Chinese-only labels, Tool names, descriptions, category counts, and actions match the accepted Manifest. The language control is intentionally absent.

## Interaction And Accessibility Evidence

- Search submit filters by name and description and renders safe highlighted text.
- A category name entered as a query produces the expected empty state.
- Category buttons, both explicit Tool routes, and the `打开` links work.
- Light, Dark, and System selections work; the mobile Dark capture has no horizontal overflow.
- `Ctrl+K` / `Cmd+K` focuses the search field.
- No custom motion is introduced in Phase 1, so reduced-motion users receive no layout animation.
- Browser console: no errors or warnings in the final production capture.

## Comparison History

1. Initial development capture: `docs/design/toolora/qa/home-phase1.png`.
   - Finding: P2 developer-only TanStack Query trigger appeared over the product surface.
   - Fix: removed the unused React Query Devtools component and dependency.
2. Post-fix production capture: `docs/design/toolora/qa/home-phase1-final.png`.
   - Evidence: the overlay is gone; the same-state full and focused comparisons show no remaining P0/P1/P2 mismatch.
3. Browser-comment revision at 1628 × 1272: `docs/design/toolora/qa/home-phase1-revised.png`.
   - Findings: the local container and cards were wider than the original Toolora layout, the theme trigger used an outlined button, and the desktop input text was too small.
   - Fixes: migrated the original `max-w-7xl`, `280px` category rail, three-column card grid, borderless theme trigger, and `18px` medium-weight input sizing.
   - Post-fix evidence: measured container 1280 px, category rail 280 px, card 312 px, input 18 px, theme border 0 px, no horizontal overflow, and no browser console errors or warnings.
4. Tool-shell browser-comment revision at 1550 × 1272: `docs/design/toolora/qa/tool-shell-phase1-revised.png`.
   - Findings: Tool pages still used the narrower shell, the Workspace header did not establish the original two-sided flex layout, and the theme control still opened a menu.
   - Fixes: moved the shared Tool shell to `max-w-7xl`, migrated the original hero and Workspace heading scale, forced the Workspace header to `flex` with `space-between`, and replaced the menu with the original one-click Light/Dark toggle and circular View Transition reveal.
   - Post-fix evidence: Tool shell, hero, and Workspace each measure 1280 px; the Workspace header reports `display: flex` and `justify-content: space-between`; heading/button sizes are 24/14 px; the theme changes Light ↔ Dark without creating a menu; reduced motion uses the immediate fallback; and the browser console is clean.

## Open Questions

None for Phase 1. Tool workspaces and the Settings Sheet remain intentionally minimal until their implementation phases.

## Implementation Checklist

- [x] Homepage hierarchy follows the selected Catalog reference.
- [x] Manifest drives search, category counts, cards, and explicit routes.
- [x] Shared Tool shell exposes the local Settings entry point.
- [x] Desktop and mobile browser states verified.
- [x] Light, Dark, System, keyboard search focus, empty state, and console verified.

## Follow-up Polish

The native circular theme transition and reduced-motion fallback are implemented. Phase 6 only needs to revalidate them against the completed Tool states.

final result: passed
