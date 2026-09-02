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

1. Visitor enters exact Target Domain, keywords, and picks country/region, language, and Search Depth from SerpAPI snapshot dropdowns.
2. An inline run hint states the Key prerequisite and the estimated SerpAPI request count.
3. 开始查询 is disabled while the form is incomplete, no Key is saved, or a Run is in progress.
4. Clicking 开始查询 directly runs automatic Key health checking, clears prior results, and starts the complete Run over all current textarea keywords and settings; no pre-run or append/replace Dialog appears.
5. Initial phase runs bounded batches without retry; stable `keyword -> keyId` affinity routes bound keywords to their Key.
6. Failed queue runs after every initial batch settles and rotates Keys only for Key-specific errors.
7. Visitor can pause scheduling, resume after refresh, retry final failures, inspect results, and export CSV.
8. Textarea edits define the next Run: removed keywords disappear from the Workspace and result table on the next Run.

## 4. Keyword Clustering

1. Visitor enters lowercase-normalized keywords, country, language, Grouping Accuracy, and optional Target Domain.
2. 开始分析 is disabled while the form is incomplete, no Key is saved, or a Run is in progress.
3. Clicking 开始分析 directly runs automatic Key health checking, clears prior Evidence, and fetches Evidence for all current textarea keywords; no pre-run or append/replace Dialog appears.
4. Initial Evidence batches run without retry; failed queue follows.
5. Web Worker clusters all Evidence in the Workspace.
6. Results show Cluster Cards/Table, Primary Keyword, Cluster Keywords, Minimum Shared URL Pair, optional Domain Analysis, No Evidence, and Failed.
7. Accuracy or Target Domain changes recompute locally; deleting a keyword from the results removes its Evidence and re-clusters locally behind one confirmation.
8. Textarea edits define the next Run: removed keywords disappear on the next Run.

## 5. Shared state behavior

- Initial progress and failed-queue progress are distinct.
- Not Found and No Evidence are valid non-error outcomes and are not retried.
- Storage failure keeps current state in memory and explains refresh risk.
- Destructive actions use confirmation dialogs with a clear cancel path.
- Success is not communicated by color alone.
- Theme choice and transition respect System and reduced-motion preferences.
