# Context Map

## Contexts

- [Platform](./docs/domain/platform/CONTEXT.md): defines Toolora, independent Tools, browser-local Workspaces, and shared SerpAPI settings
- [Keyword Ranking](./docs/domain/keyword-ranking/CONTEXT.md): finds a target domain's organic rank for a list of keywords
- [Keyword Clustering](./docs/domain/keyword-clustering/CONTEXT.md): groups keywords by overlap among their organic search results

## Relationships

- **Platform → Keyword Ranking**: supplies the Tool shell, Workspace, and SerpAPI Settings
- **Platform → Keyword Clustering**: supplies the Tool shell, Workspace, and SerpAPI Settings
- **Keyword Ranking ↔ Keyword Clustering**: share SERP access capabilities but have independent inputs, Workspaces, and results
