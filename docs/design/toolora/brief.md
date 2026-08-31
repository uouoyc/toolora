# Toolora Redesign Brief

Status: visual direction selected
Date: 2026-08-30

## Goal

Redesign the Toolora homepage, Keyword Ranking, Keyword Clustering, and shared SerpAPI Settings as one coherent product. The result should feel like the current Toolora evolved: minimal, practical, content-first, and built from shadcn/ui primitives rather than a dense SaaS dashboard.

## Surfaces

1. Homepage Tool Catalog
2. Keyword Ranking Workspace
3. Keyword Clustering Workspace
4. SerpAPI Settings
5. Shared confirmation, progress, empty, error, storage-recovery, and unsaved states
6. Light, Dark, and System theme behavior

## Fixed product decisions

- Chinese UI only
- anonymous use, no accounts or history
- one current Workspace per Tool
- browser-local BYOK SerpAPI Settings
- homepage search and category filters
- explicit Tool routes
- Keyword Ranking supports up to 1000 keywords and Top 10–50
- Keyword Clustering supports up to 1000 keywords, Top 10 Evidence, and one Grouping Accuracy
- manual keyword input only; no upload
- Next.js renders the page shell and SEO content; Tool interaction is client-side
- no Analytics, content generation, Search Intent, Topical Clusters, URL Map, or Target URL editor

## Visual direction

- preserve Toolora's restrained, rounded, spacious character
- use the existing shadcn/ui and design-token foundation
- keep hierarchy obvious without copying Keyword Insights branding or dashboard chrome
- support dense data when needed without making the initial screen feel enterprise-heavy
- theme transition should be brief, progressive, and reduced-motion safe

The selected reference is [`options/selected-keyword-clustering-results.png`](./options/selected-keyword-clustering-results.png). It is a hierarchy and visual-language target, not a pixel-perfect implementation contract.

## Reference use

- Old Toolora: homepage catalog, Tool shell, simple form/result language, and theme
- Keyword Insights: advanced settings disclosure, pre-run summary, Cluster Card/Table information architecture
- Existing KeyPage: behavior reference only, not visual direction

Local screenshots and research remain under ignored `docs/research/`.

## Visual selection frame

The first three visual directions each use one focused desktop Keyword Clustering results screen. This is the densest representative surface and is sufficient to compare hierarchy, navigation, Tool shell, settings entry, result density, and theme language without turning one image into a multi-screen feature inventory.

After one direction is selected, apply it to the homepage, Keyword Ranking, SerpAPI Settings, Light/Dark, and mobile/reflow states before implementation. The selected direction must later cover keyboard focus, dialogs, progress, errors, storage recovery, and theme transition.

## Exclusions

- no production implementation during visual selection
- no invented logo or illustration system
- no third-party dashboard shell
- no charts unless a confirmed result genuinely needs one
- no decorative animation beyond theme/state transitions
