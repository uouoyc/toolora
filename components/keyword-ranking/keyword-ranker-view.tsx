import { useKeywordRanker } from "@/hooks/use-keyword-ranker";

import { RankerHero } from "./ranker-hero";
import { RankerMetrics } from "./ranker-metrics";
import { RankerResults } from "./ranker-results";
import { RankerSettings } from "./ranker-settings";
import { RankerStatus } from "./ranker-status";
import { RankerWorkspace } from "./ranker-workspace";

export function KeywordRankerView() {
  const {
    domain,
    keywords,
    country,
    language,
    limit,
    setDomain,
    setKeywords,
    setCountry,
    setLanguage,
    setLimit,
    isDrawerOpen,
    setIsDrawerOpen,
    keys,
    strategy,
    handleStrategyChange,
    handleKeysChange,
    results,
    paginatedResults,
    isQuerying,
    queryStatus,
    queryError,
    queryProgress,
    metrics,
    handleQueryStart,
    currentPage,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
    handleExportWithKey,
  } = useKeywordRanker();

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-0">
      <RankerHero />

      <div className="space-y-8">
        <RankerWorkspace
          domain={domain}
          keywords={keywords}
          country={country}
          language={language}
          limit={limit}
          onDomainChange={setDomain}
          onKeywordsChange={setKeywords}
          onCountryChange={setCountry}
          onLanguageChange={setLanguage}
          onLimitChange={setLimit}
          onSettingsOpen={() => setIsDrawerOpen(true)}
          onQueryStart={handleQueryStart}
          hasKeys={keys.length > 0}
          isQuerying={isQuerying}
          progress={queryProgress}
        />

        <RankerStatus
          status={queryStatus}
          found={metrics.found}
          total={metrics.total}
          failed={metrics.failed}
          error={queryError}
        />

        {(metrics.total > 0 || results.length > 0) && (
          <RankerMetrics
            total={metrics.total}
            found={metrics.found}
            missed={metrics.missed}
            failed={metrics.failed}
          />
        )}

        {results.length > 0 && (
          <RankerResults
            results={paginatedResults}
            allResults={results}
            currentPage={currentPage}
            pageSize={pageSize}
            total={results.length}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onExportWithKey={handleExportWithKey}
          />
        )}
      </div>

      <RankerSettings
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        strategy={strategy}
        onStrategyChange={handleStrategyChange}
        keys={keys}
        onKeysChange={handleKeysChange}
      />
    </div>
  );
}
