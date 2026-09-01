# Keyword Ranking

Keyword Ranking finds where a Target Domain appears in organic results for each supplied keyword within a chosen Search Depth.

## Language

**Target Domain**:
The exact normalized hostname whose organic position the visitor wants to find. A leading `www.` is ignored; other subdomains are distinct Target Domains.
_Avoid_: Website URL, competitor

**Search Depth**:
The maximum number of organic results examined for each keyword, from Top 10 through Top 50.
_Avoid_: Page count, crawl depth

**Run**:
One browser-managed attempt to process the current Workspace's keywords. Closing the Tool page stops the Run.
_Avoid_: Job, project, report

**Key Affinity**:
The browser-private mapping from a keyword to the Key that last completed it with a Found or Not Found outcome. It survives query-settings changes while the keyword stays in the Workspace and never appears in results or exports.
_Avoid_: Key binding cache, key history

**Locale Snapshot**:
The committed official SerpAPI country (`gl`) and language (`hl`) lists owned by SerpAPI Settings. Country and language are chosen from snapshot members; codes may be multi-part, such as `zh-cn`.
_Avoid_: Locale list, ISO country table

**Found**:
The Target Domain appears within the chosen Search Depth and has a trustworthy rank and URL.
_Avoid_: Success

**Not Found**:
The search completed successfully, but the Target Domain did not appear within the chosen Search Depth.
_Avoid_: Failed, no result

**Failed**:
The search could not produce a trustworthy ranking result because the request or Provider failed.
_Avoid_: Not Found
