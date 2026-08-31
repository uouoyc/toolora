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
  location: string;
  language: string;
  groupingAccuracy: number;
  targetDomain: string | null;
};
```

Keywords use the same normalization as Keyword Ranking and are stored/displayed in lowercase. Grouping Accuracy defaults to 4 and accepts 1–10. Target Domain is optional and uses exact normalized hostname matching, ignoring only a leading `www.`.

## Workspace

Store one versioned Workspace record under `keyword-clustering` using `idb-keyval`.

- **添加到当前分析** fetches Evidence only for new keywords and re-clusters all old plus new keywords.
- **开始新分析** confirms, offers export, and replaces the current Workspace.
- deleting keywords removes their Evidence and re-clusters all remaining keywords.
- changing Grouping Accuracy re-clusters without SerpAPI.
- changing Target Domain recomputes Domain Analysis without SerpAPI.
- changing location/language confirms, clears Evidence, and fetches all keywords.
- no Project list, Analysis history, or server persistence exists.

Evidence up to 24 hours old is reused when appending. If older Evidence exists, the user chooses between fetching only new keywords and refreshing all.

## Evidence procedure

`keywordClustering.fetchBatch` accepts at most five keywords, one Key, location/language, and Tool-fixed `google_light` semantics. It returns validated Top 10 organic URLs per keyword, with no titles, snippets, raw Provider metadata, or Key data.

Outcomes:

- Evidence Ready — one or more valid normalized URLs
- No Evidence — successful request with zero valid URLs; excluded from Clusters and not retried
- Failed — failed after the failed queue; excluded from Clusters

## URL comparison key

For overlap comparison:

- accept HTTP/HTTPS only
- lowercase hostname
- ignore a leading `www.`
- treat HTTP and HTTPS as equivalent
- remove default ports and fragment
- remove `utm_*`, `gclid`, `fbclid`, `msclkid`, `srsltid`, and `ved`
- sort remaining query parameters while preserving their values
- remove non-root trailing slash
- preserve full path and meaningful query parameters
- deduplicate within each SERP
- exclude unparseable URLs

## Clustering algorithm

Run deterministic complete-link Agglomerative clustering in a Web Worker:

1. compute every Pair's unique shared normalized URLs
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
6. A Minimum Shared URL Pair contains two distinct Cluster members, unique normalized shared URLs, and `sharedUrlCount === sharedUrls.length`.
7. Domain Analysis match URLs are unique normalized URLs whose exact hostname matches Target Domain.

Deterministic rules:

- Primary Keyword has the greatest total overlap with other Cluster members; input order breaks ties.
- Minimum Shared URL Pair uses the lowest shared count; original Pair input positions break ties.
- Pair keyword A/B follow original input order.
- Shared URLs follow keyword A's SERP rank order.
- Domain match URLs are collected by Cluster input order, then SERP rank, first occurrence wins.
- Clusters sort by their earliest input member before IDs are assigned.

Possible Cannibalization means multiple exact-host match URLs occur in one Cluster. It is a warning, not a confirmed diagnosis.

## Result presentation

- Cluster Cards and compact Table view
- Primary Keyword and Cluster keywords
- Minimum Shared URL Pair and drill-down Evidence
- optional Domain Analysis and Possible Cannibalization
- separate No Evidence and Failed sections
- filter by name/contents as selected in design
- one CSV export

## CSV

Each input keyword occupies one row:

```text
keyword
status
cluster_id
primary_keyword
is_primary_keyword
cluster_size
minimum_pair_keyword_a
minimum_pair_keyword_b
minimum_shared_url_count
target_domain
domain_match_urls
has_possible_cannibalization
error_code
location
language
grouping_accuracy
evidence_fetched_at
```

Statuses are `clustered`, `singleton`, `no_evidence`, and `failed`.

- no Target Domain → target/domain cells blank
- Target Domain with no match → match URLs blank, cannibalization `false`
- one match → URL, `false`
- multiple matches → URLs joined with ` | `, `true`
- No Evidence/Failed → Cluster and Domain Analysis fields blank
- Failed alone carries error code
- omit full Minimum Shared URL Pair URLs from CSV; view them in UI
- use UTF-8 BOM and formula-injection protection

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
- append 300 then 700 and globally re-cluster all 1000
- 24-hour Evidence decision
- Domain Analysis null/empty/one/multiple states
- No Evidence and Failed exclusion
- Web Worker request/result behavior
- CSV row values and tri-state domain fields
- Browser input, progress, replacement, storage, result, theme, and responsive states

## Acceptance

The Tool is complete when up to 1000 manually entered keywords can be fetched in bounded batches, globally clustered deterministically in the browser, recovered in one Workspace, optionally analyzed against an exact Target Domain, exported safely, and verified through automated seams and the in-app Browser.
