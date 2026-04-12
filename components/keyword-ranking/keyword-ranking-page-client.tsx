"use client";

import dynamic from "next/dynamic";

const KeywordRankerView = dynamic(
  () =>
    import("@/components/keyword-ranking/keyword-ranker-view").then(
      (m) => m.KeywordRankerView,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-100 items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    ),
  },
);

export function KeywordRankingPageClient() {
  return <KeywordRankerView />;
}
