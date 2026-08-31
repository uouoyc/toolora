---
status: accepted
---

# Complete-link SERP clustering

Keyword Clustering uses each keyword's Top 10 normalized full ranking URLs, a configurable Grouping Accuracy defaulting to 4, and deterministic complete-link Agglomerative merging: two Clusters merge only when every cross-Cluster Pair meets the threshold. The algorithm runs in a browser Web Worker over at most 1000 keywords using compact Pair storage. This favors smaller, tighter page-level Clusters and predictable local recomputation over broader Centroid grouping, Topical/NLP clusters, or server jobs.
