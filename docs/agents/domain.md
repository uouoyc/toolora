# Domain Docs

How the engineering skills consume this repo's domain documentation.

## Before exploring, read these

- `CONTEXT-MAP.md` at the repo root, then each linked `CONTEXT.md` relevant to the topic.
- `docs/adr/` for system-wide decisions.
- `docs/domain/<context>/docs/adr/` for context-specific decisions.

If these files do not exist, proceed silently. The domain-modeling skills create them lazily when terms or decisions are resolved.

## File structure

```text
/
├── CONTEXT-MAP.md
├── docs/adr/
└── docs/domain/
    └── <context>/
        ├── CONTEXT.md
        └── docs/adr/
```

`CONTEXT-MAP.md` lists only contexts that have domain documentation.

## Use the glossary's vocabulary

When output names a domain concept, use the term defined in the relevant `CONTEXT.md`. Do not drift to synonyms the glossary explicitly avoids.

If a needed concept is absent, reconsider whether the language belongs to the project or note the gap for domain modeling.

## Flag ADR conflicts

Surface conflicts with existing ADRs explicitly rather than silently overriding them:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
