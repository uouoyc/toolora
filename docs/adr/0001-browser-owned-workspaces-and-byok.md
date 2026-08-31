---
status: accepted
---

# Browser-owned Workspaces and BYOK

Toolora has no accounts, server database, Project history, or platform-owned SerpAPI quota. Each Tool keeps one current Workspace in the visitor's browser, and shared SerpAPI Settings keep visitor-provided keys in `localStorage`; Hono receives only the Key needed for a request and stores no visitor state. This accepts that closing a Tool page stops its Run and that same-origin scripts can access browser Keys, in exchange for anonymous use, no identity system, no secret custody, and a substantially smaller operational surface.
