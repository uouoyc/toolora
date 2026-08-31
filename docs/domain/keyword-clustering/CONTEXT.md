# Keyword Clustering

Keyword Clustering groups keywords whose Top 10 organic results overlap strongly enough that one page may cover them together.

## Language

**SERP Evidence**:
The normalized full ranking URLs from one keyword's Top 10 organic results for a specific location and search language.
_Avoid_: Snapshot history, cache

**Grouping Accuracy**:
The minimum number of full ranking URLs two keywords must share before they can belong to the same Cluster.
_Avoid_: Confidence, similarity percentage, merge threshold

**Cluster**:
A set of keywords in which every member satisfies the Grouping Accuracy relationship required by the clustering algorithm.
_Avoid_: Page, topic, topical cluster

**Singleton Cluster**:
A Cluster containing one keyword because it could not be grouped confidently with another keyword.
_Avoid_: Ungrouped keyword, failed keyword

**Primary Keyword**:
The Cluster member with the greatest total URL overlap with the other members. Input order breaks ties.
_Avoid_: Representative keyword, highest-volume keyword

**Minimum Shared URL Pair**:
The pair of Cluster members with the fewest shared URLs. Input order selects the pair when multiple pairs share the minimum.
_Avoid_: Weakest pair, confidence score

**Domain Analysis**:
The optional evaluation of a Cluster against a Target Domain. Its absence means the Analysis did not include a Target Domain.
_Avoid_: URL Map, rank tracking

**Domain Match**:
A URL whose exact normalized hostname matches the optional Target Domain and appears in a Cluster member's SERP Evidence. A leading `www.` is ignored; other subdomains remain distinct.
_Avoid_: Target URL, suggested URL

**Possible Cannibalization**:
The condition where multiple URLs from the optional Target Domain appear across one Cluster's SERP Evidence.
_Avoid_: Confirmed cannibalization
