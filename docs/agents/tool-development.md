# Tool Development

Read this before adding or changing a Tool.

## Context first

1. Read [`CONTEXT-MAP.md`](../../CONTEXT-MAP.md).
2. Read the relevant `docs/domain/<context>/CONTEXT.md`.
3. Read ADRs that affect the Tool.
4. Read the Tool's `docs/specs/<slug>.md` when it exists.
5. Trace one existing Tool from page to procedure before choosing a seam.

## Add a Tool

1. Add one item to the static Tool Manifest: `slug`, `name`, `description`, and `category`.
2. Add an explicit Next route at `apps/web/src/app/<slug>/page.tsx`.
3. Add a feature at `apps/web/src/features/<slug>/` for the Tool's Workspace, interactions, client algorithm, and result UI.
4. Add browser-safe Zod contracts under `packages/api/src/contracts/`.
5. Add Tool-specific oRPC procedures under `packages/api/src/procedures/` only when the Tool needs server work.
6. Add external adapters under `apps/server/src/integrations/`; keep Provider payloads inside the adapter.
7. Add a Tool glossary or update the relevant one when new domain language is resolved.
8. Add one vertical red → green slice through every public seam before expanding the feature.

Completion means the Tool has an explicit route, Manifest item, accepted contract, Workspace behavior, stable errors, tests at agreed seams, and Browser evidence for success/error/responsive/theme states.

## Placement rules

- Next.js owns routes, page content, SEO, and browser UI.
- Hono/oRPC owns every Tool business request.
- Browser Workspaces own visitor state; Hono remains stateless.
- `packages/api` owns Zod contracts, oRPC procedures, Context interfaces, and stable errors.
- `packages/ui` owns generic shadcn/ui primitives and tokens, never Tool forms or results.
- Feature code shared by Tools in the same app stays in that app.

## Package gate

Create a package only when all are true:

1. at least two different workspaces consume the behavior
2. the module has a stable, small interface
3. it has an independent dependency, runtime, or test boundary
4. deleting the package would spread meaningful complexity across those workspaces

Two Tools in `apps/web` do not justify a package. One implementation does not justify a Provider Factory or Registry.

## Contract rules

- Zod input/output schemas are the source of truth; infer TypeScript types.
- Validate external payloads before translating them into Toolora results.
- Return stable Toolora error codes, never raw Provider errors.
- Keep secrets out of URLs, logs, persisted Tool results, CSV, and screenshots.
- Public procedure names stay Tool-specific; do not expose a generic arbitrary search procedure.

## Workspace rules

- One current Workspace per Tool, keyed by Tool slug.
- Starting a new Analysis replaces that Tool's Workspace after confirmation.
- Storage failure keeps live data in memory and requires explicit user choice before deleting prior data.
- Schema incompatibility replaces the current Workspace; no history migration layer is maintained.

## Verification

Run the smallest affected commands while iterating, then complete:

```powershell
pnpm check
pnpm check-types
pnpm test
pnpm build
```

Use Hono `app.request()` at the server seam and the in-app Browser for the final user journey. Docker smoke runs through the WSL Docker Engine. Do not stage, commit, or push unless separately authorized.
