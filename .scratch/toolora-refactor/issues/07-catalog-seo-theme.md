# Phase 6: Catalog, SEO, and theme polish

Status: resolved
Type: task
Blocked by: 06

Finish homepage matching/highlighting/filtering, metadata/canonical/sitemap/robots, theme transition, shared states, responsive layouts, and selected design fidelity across both Tools. Do not add Analytics, structured data, or generated content.

Validation: build, keyboard/reduced-motion checks, browser visual comparison, and responsive states.

## Comments

2026-09-02: Resolved and committed on `main` (not pushed):

- `67b9708` feat: add site url config with canonical sitemap and robots
- `ddbf0fb` feat: finish catalog live search and design fidelity
- `960b96f` fix: stack pagination below md to prevent mobile overflow
- `d83e469` docs: record phase 6 catalog seo and theme evidence

Delivered: SEO shell via env-controlled `NEXT_PUBLIC_SITE_URL` (local fallback `http://localhost:3001`, no hardcoded domain — user decision) with `metadataBase`, per-page canonical, minimal OG (no images), viewport `themeColor` light/dark, static `sitemap.xml` (home + both Tool routes) and `robots.txt`; root canonical/sitemap emit Next's slash-less root normalization consistently. Homepage catalog finished per deconstruction §3.11 (command hint `hidden md:flex bg-background/50`, equal-height `min-h-13` search row with `ring-4 ring-primary/10` focus, sticky category rail with `shadow-lg shadow-primary/20` indicator and `99+`-capped two-digit counts, tool-card hover 四件套 with `group-hover:text-primary`, `rounded-4xl` tag badges, h-8 full-width CTA, dashed empty state, `py-8` rhythm) with card headings fixed to `<h2>`; search interaction switched to the original site's live filtering (user decision; submit-based Phase 1 UX retired), 搜索 button focuses the input. Shared Pagination restored the §3.9 mobile stack (`flex-col` → `md:flex-row`), fixing a measured 36px horizontal overflow on keyword-ranking at 375px (both Tool pages now zero overflow). Validation: `pnpm check` (zero diagnostics) / `check-types` / `test` (server 23 / web 90, +10 new for `formatCategoryCount` and `lib/site`) / `build` (8 routes incl. robots/sitemap) / `git diff --check` all green; browser QA on 3001 covered live search + highlight, category combine, empty state, Ctrl+K, tab order, View Transition reveal (spy-verified) with reduced-motion immediate fallback, System-follow, light/dark, 375/768/1024/1280 breakpoints, and both Tool pages' §11.5 fidelity (h-12/16px/ring-4 controls, flat gap-8 rhythm). Evidence in `docs/design/toolora/design-qa.md` (Phase 6 section) + 4 captures under `docs/design/toolora/qa/`. No Analytics, structured data, or generated content; no `font-mono`; `docs/specs` untouched.
