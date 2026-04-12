"use client";

import { memo } from "react";

import { useLocale, useTranslations } from "next-intl";

import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { Language, Tool } from "@/lib/tools";

interface ToolCardProps {
  tool: Tool;
}

export const ToolCard = memo(function ToolCard({ tool }: ToolCardProps) {
  const locale = useLocale();
  const lang: Language = locale === "zh-CN" ? "zh" : "en";
  const t = useTranslations("home");
  const router = useRouter();

  return (
    <article className="group border-border bg-card hover:bg-accent/50 hover:border-primary/20 hover:shadow-primary/5 flex flex-col rounded-3xl border p-5 transition-all duration-300 hover:shadow-2xl">
      {/* Title */}
      <div className="mb-2 flex items-center justify-between gap-4">
        <h3 className="group-hover:text-primary text-xl font-bold tracking-tight transition-colors">
          {tool.title[lang]}
        </h3>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-6 grow text-sm leading-relaxed">
        {tool.description[lang]}
      </p>

      {/* Tags */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tool.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="font-mono text-[10px]">
            {tag}
          </Badge>
        ))}
      </div>

      <Button
        onClick={() => router.replace(`/${tool.id}`)}
        className="w-full cursor-pointer"
      >
        {t("open")}
        <ArrowUpRight size={14} />
      </Button>
    </article>
  );
});
