import type { Metadata } from "next";

import { KeywordRankingPageClient } from "@/components/keyword-ranking/keyword-ranking-page-client";
import { getMessage, loadMessages, resolveLocale } from "@/lib/i18n";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);
  const messages = await loadMessages(locale);

  return {
    title: getMessage(messages, "keywordRanking.hero.title"),
    description: getMessage(messages, "keywordRanking.hero.description"),
  };
}

export default async function KeywordRankingPage() {
  return <KeywordRankingPageClient />;
}
