"use client";

import { useLocale, useTranslations } from "next-intl";

import { ToolCard } from "@/components/tool-card";
import type { Category, Language, Tool } from "@/lib/tools";

interface ToolGridProps {
  categories: Category[];
  activeCategory: string;
  tools: Tool[];
}

export function ToolGrid({ categories, activeCategory, tools }: ToolGridProps) {
  const locale = useLocale();
  const lang: Language = locale === "zh-CN" ? "zh" : "en";
  const t = useTranslations("home");

  const activeLabel =
    categories.find((c) => c.id === activeCategory)?.label[lang] ??
    categories[0]?.label[lang] ??
    "";

  return (
    <main className="w-full min-w-0">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="text-3xl font-bold tracking-tight">{activeLabel}</h1>
      </div>

      {tools.length === 0 ? (
        <div className="border-border flex min-h-60 w-full items-center justify-center rounded-2xl border border-dashed p-8">
          <p className="text-muted-foreground text-sm">{t("emptyState")}</p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      )}
    </main>
  );
}
