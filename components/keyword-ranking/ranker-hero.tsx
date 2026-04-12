import { memo } from "react";

import { useTranslations } from "next-intl";

export const RankerHero = memo(function RankerHero() {
  const t = useTranslations("keywordRanking");

  return (
    <section className="mb-8">
      <div className="border-border bg-card/50 relative overflow-hidden rounded-[2rem] border p-8">
        <h1 className="mb-4 text-4xl font-bold tracking-tighter">
          {t("hero.title")}
        </h1>
        <p className="text-muted-foreground max-w-3xl leading-relaxed">
          {t("hero.description")}
        </p>
      </div>
    </section>
  );
});
