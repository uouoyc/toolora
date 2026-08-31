# Toolora Product Flows

## 1. Homepage Catalog

1. Visitor lands on a server-rendered Chinese homepage.
2. Search matches Tool name and description and highlights every visible match.
3. Category filters combine with search.
4. Empty State explains that no Tool matches.
5. Tool Card opens its explicit route.

## 2. SerpAPI Settings

1. Visitor opens Settings from either Tool.
2. Visitor enters one Key per line and selects Round Robin or Sequential.
3. Save trims and deduplicates Keys, then stores masked entries locally.
4. Detect All shows Active, Unknown, Invalid, Forbidden, Quota Exhausted, or Rate Limited.
5. Save failure offers memory-only use or deletion of prior SerpAPI Settings and retry.
6. Changes made during a Run apply to the next Run.

## 3. Keyword Ranking

1. Visitor enters exact Target Domain, keywords, country, language, and Search Depth.
2. Existing Workspace offers Add to Current Query or Start New Query.
3. Evidence older than 24 hours triggers New Only versus Refresh All choice.
4. Pre-run Dialog summarizes keyword count, estimated calls, query settings, and eligible Keys.
5. Initial phase runs bounded batches without retry.
6. Failed queue runs after every initial batch settles.
7. Visitor can pause scheduling, refresh/restore, retry final failures, inspect results, and export CSV.
8. Starting a new query offers export before replacing the Workspace.

## 4. Keyword Clustering

1. Visitor enters lowercase-normalized keywords, location, language, Grouping Accuracy, and optional Target Domain.
2. Existing Workspace offers Add to Current Analysis or Start New Analysis.
3. Evidence older than 24 hours triggers New Only versus Refresh All choice.
4. Pre-run Dialog summarizes keyword count, estimated calls, settings, and eligible Keys.
5. Initial Evidence batches run without retry; failed queue follows.
6. Web Worker clusters all Evidence in the Workspace, including old plus newly added keywords.
7. Results show Cluster Cards/Table, Primary Keyword, Cluster Keywords, Minimum Shared URL Pair, optional Domain Analysis, No Evidence, and Failed.
8. Accuracy or Target Domain changes recompute locally.
9. Location/language changes confirm and replace all Evidence.
10. Starting a new Analysis offers export before replacing the Workspace.

## 5. Shared state behavior

- Initial progress and failed-queue progress are distinct.
- Not Found and No Evidence are valid non-error outcomes and are not retried.
- Storage failure keeps current state in memory and explains refresh risk.
- Destructive actions use confirmation dialogs with a clear cancel path.
- Success is not communicated by color alone.
- Theme choice and transition respect System and reduced-motion preferences.
