# Keyword Clustering Specification

## Product

- Slug: `keyword-clustering`
- Chinese name: 关键词聚类
- Purpose: group keywords whose organic SERPs overlap strongly enough that one page may cover them together
- Maximum: 1000 normalized keywords in one current Analysis
- No file upload, search volume, Search Intent, Topical Clusters, URL Map, Target URL, slug generation, or history

## Input

```ts
type KeywordClusteringInput = {
  keywords: string[];
  country: string;
  language: string;
  groupingAccuracy: number;
  targetDomain: string | null;
};
```

Keywords use the same normalization as Keyword Ranking and are stored/displayed in lowercase. Grouping Accuracy defaults to 4 and accepts 1–10. Target Domain is optional and uses exact normalized hostname matching, ignoring only a leading `www.`.

## Workspace

Store one versioned Workspace record under `keyword-clustering` using `idb-keyval`.

- The keyword textarea is the single source of truth. Every click on 开始分析 fetches Evidence for **all current textarea keywords** with the current country, language, Grouping Accuracy, and Target Domain.
- Each run immediately clears prior Evidence, syncs the Workspace to the textarea (removed keywords disappear from the Workspace and results on the next Run), and keeps `keyword -> keyId` affinity for keywords that remain.
- 开始分析 is disabled while the form is incomplete, no Key is saved, or a Run is in progress. Once at least one Key is saved, clicking Start runs automatic Key health checking and then the fetch; no pre-run confirmation exists.
- deleting a keyword from the results removes its Evidence and re-clusters all remaining keywords locally behind one confirmation dialog, without SerpAPI. Deletion never special-cases the Primary Keyword: the deterministic rules produce the next Primary, or the Cluster dissolves when the remaining members no longer meet Grouping Accuracy.
- changing Grouping Accuracy re-clusters without SerpAPI.
- changing Target Domain recomputes Domain Analysis without SerpAPI.
- no Project list, Analysis history, or server persistence exists.

There is no append/new-analysis choice and no 24-hour Evidence reuse decision; those flows are intentionally removed, mirroring Keyword Ranking. Only the Workspace storage-failure recovery Dialog and the keyword-deletion confirmation remain.

## Evidence procedure

`keywordClustering.fetchBatch` accepts at most five keywords, one Key, country/language, and Tool-fixed `google_light` semantics. It returns the Top 10 organic results per keyword as raw URL + page identity pairs, with no titles, snippets, raw Provider metadata, or Key data. The raw URL is kept for reference; every comparison, deduplication, count, and export uses the identity.

Outcomes:

- Evidence Ready — one or more valid page identities
- No Evidence — successful request with zero valid identities; excluded from Clusters and not retried
- Failed — failed after the failed queue; excluded from Clusters

## URL identity

The page is its host plus its path, nothing else — query parameters never decide page identity, so tracking parameters (`gclid`, `gbraid`, `gad_source`, `utm_*`, …) and business parameters (`?page=2`, `?id=…`) alike collapse onto the same page:

1. accept HTTP/HTTPS only; scheme and port are not part of identity
2. lowercase hostname and drop a leading `www.` (other subdomains stay distinct)
3. drop the entire query string and fragment
4. collapse repeated slashes in the path
5. drop default index documents (`index.html`, `index.htm`, `index.php`, case-insensitive)
6. drop a trailing slash; the root path stays `/`
7. identity = `hostname + pathname` (for example `https://www.example.com/foo/?page=2` → `example.com/foo`)

SERP Evidence deduplicates by identity within each SERP, first (highest-ranked) occurrence wins; unparseable URLs are excluded.

## Clustering algorithm

Run deterministic complete-link Agglomerative clustering in a Web Worker:

1. compute every Pair's unique shared page identities
2. store overlap counts in a compact triangular `Uint8Array`
3. begin with Singleton Clusters
4. consider merge candidates by descending shared URL count and deterministic input order
5. merge two Clusters only when every cross-Cluster Pair meets Grouping Accuracy
6. repeat until no merge is possible
7. sort members and Clusters by original input order
8. generate Analysis-scoped sequential Cluster IDs

At 1000 keywords there are 499,500 Pairs. More than 1000 keywords, file upload, Centroids, server jobs, and distributed processing are outside scope.

## Result types

```ts
type MinimumSharedUrlPair = {
  keywordA: string;
  keywordB: string;
  sharedUrlCount: number;
  sharedUrls: string[];
};

type DomainAnalysis = {
  matchUrls: string[];
  hasPossibleCannibalization: boolean;
};

type KeywordCluster = {
  clusterId: string;
  primaryKeyword: string;
  clusterKeywords: string[];
  minimumSharedUrlPair: MinimumSharedUrlPair | null;
  domainAnalysis: DomainAnalysis | null;
};
```

## Invariants

1. Cluster ID is unique only within the current Analysis.
2. Cluster keywords are non-empty, unique, lowercase, and include Primary Keyword.
3. `(clusterKeywords.length === 1) === (minimumSharedUrlPair === null)`.
4. `(targetDomain === null) === (domainAnalysis === null)`.
5. When Domain Analysis exists, `hasPossibleCannibalization === (new Set(matchUrls).size > 1)`.
6. A Minimum Shared URL Pair contains two distinct Cluster members, unique shared page identities, and `sharedUrlCount === sharedUrls.length`.
7. Domain Analysis match URLs are unique page identities whose exact host matches Target Domain.

Deterministic rules:

- Primary Keyword has the greatest total overlap with other Cluster members; input order breaks ties.
- Minimum Shared URL Pair uses the lowest shared count; original Pair input positions break ties.
- Pair keyword A/B follow original input order.
- Shared URLs follow keyword A's SERP rank order.
- Domain match URLs are collected by Cluster input order, then SERP rank, first occurrence wins.
- Clusters sort by their earliest input member before IDs are assigned.

Possible Cannibalization means multiple exact-host match URLs occur in one Cluster. It is a warning, not a confirmed diagnosis.

## Result presentation

The Cluster is the only first-class result object across every surface.

- Cluster Cards and the compact Table both present Clusters. The table main row, pagination, and filtering operate on Clusters; Keywords exist only as expanded members. Any future sorting must also operate on Clusters, never on expanded Keyword members.
- the table member summary shows the first three Keywords joined with `·` plus a `+N` remainder (for example `a · b · c +7`); the full member list with roles and per-keyword Evidence appears in the expanded row
- Primary Keyword and Cluster keywords
- Minimum Shared URL Pair ("最低 SERP 重合") and drill-down Evidence ("搜索结果 n/10")
- optional Domain Analysis ("目标网站匹配")
- clustering status (independent vs clustered) and Target Domain matches stay separate dimensions; Possible Cannibalization ("可能页面竞争") marks the match column and never the status
- separate No Evidence and Failed sections
- filter by name/contents as selected in design
- one export action with two CSV outputs, defined below

## CSV

One export action offers two CSVs. Both use UTF-8 BOM and formula-injection protection. Cells joined with ` | ` are display-oriented encoding, not a guaranteed round-trip format.

**Cluster CSV (default)** — one row per Cluster:

```text
cluster_id
cluster_status
primary_keyword
keywords
cluster_size
weakest_pair
minimum_shared_url_count
target_domain
target_domain_match_count
target_domain_match_urls
has_possible_cannibalization
country
language
grouping_accuracy
```

- `cluster_status` values are `clustered` and `singleton`; No Evidence and Failed keywords never appear here because they are not Clusters
- `keywords` and `target_domain_match_urls` join values with ` | `; exported URLs are page identities
- `weakest_pair` renders `a ↔ b` and is blank for singletons
- no Target Domain → the three target columns are blank; with a Target Domain, `target_domain_match_urls` is blank at zero matches and `has_possible_cannibalization` is `false` unless multiple match URLs exist

**Keyword detail CSV (secondary)** — one row per input keyword:

```text
keyword
keyword_status
cluster_id
cluster_primary_keyword
keyword_role
cluster_size
evidence_result_count
error_code
evidence_fetched_at
country
language
grouping_accuracy
```

- statuses are `clustered`, `singleton`, `no_evidence`, and `failed`
- `keyword_role` is `primary` or `member`, blank outside Clusters
- `evidence_result_count` is the fetched result count (`0` for No Evidence, blank for Failed or unfetched); only `failed` carries `error_code`
- `grouping_accuracy` is an integer between 1 and 10 (a shared-URL threshold, not a percentage)
- omit full Minimum Shared URL Pair URLs from both exports; view them in the UI

## Storage failure

On IndexedDB failure, retain current state in memory and show one Dialog:

- continue without saving
- delete only the prior Keyword Clustering Workspace and retry

An unsaved state remains visible after choosing memory-only mode.

## Test seams

- keyword/URL/Target Domain normalization
- Pair overlap and compact matrix indexing
- deterministic merge ordering and all invariants
- Primary Keyword and Minimum Shared URL Pair tie-breaks
- clustering 1000 keywords at full scale with deterministic results
- Domain Analysis null/empty/one/multiple states
- No Evidence and Failed exclusion
- Web Worker request/result behavior
- Cluster CSV and Keyword detail CSV row values and tri-state target fields
- Browser input, progress, replacement, storage, result, theme, and responsive states

## Acceptance

The Tool is complete when up to 1000 manually entered keywords can be fetched in bounded batches, globally clustered deterministically in the browser, recovered in one Workspace, optionally analyzed against an exact Target Domain, exported safely, and verified through automated seams and the in-app Browser.
