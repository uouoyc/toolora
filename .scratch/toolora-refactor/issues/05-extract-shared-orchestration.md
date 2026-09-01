# Phase 4: Extract proven shared orchestration

Status: ready-for-agent
Type: task
Blocked by: 04

Compare completed Keyword Ranking behavior with Keyword Clustering needs. Extract only identical batch, Key, and stable-error behavior within the existing Web/Server workspaces. Do not create a new package unless the documented package gate is satisfied.

Validation: ranking behavior remains unchanged and tests cross the same public seams.

## Comments

2026-09-01: Timing guidance recorded in `docs/design/toolora/reference-ui-deconstruction.md` section 11.4 — extract shared recipes (SectionCard, Field, Microlabel, StatusPill, DataTableHead, Banner, Pagination) when Keyword Clustering becomes the second consumer; keep single-use components inside the clustering feature. Placement per `docs/agents/tool-development.md`: shared tool-shaped UI stays in `apps/web`, not `packages/ui`.

2026-09-01 (clarification): Scope is the orchestration layer only — batch splitting/concurrency, Key affinity and rotation, failed-queue traversal, stable error codes, and the oRPC procedure pattern — all pinned by the clustering spec, so this is not speculative. The UI recipe list in deconstruction §11.4 (SectionCard, StatusPill, Banner, Pagination, ...) stays OUT of this ticket and extracts lazily during 06 when clustering's UI shape is real. 06 remains blocked by this ticket.
