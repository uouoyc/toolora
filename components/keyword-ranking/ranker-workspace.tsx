import { useTranslations } from "next-intl";

import { ArrowUpRight, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { COUNTRIES, LANGUAGES } from "@/lib/search-config";

interface RankerWorkspaceProps {
  domain: string;
  keywords: string;
  country: string;
  language: string;
  limit: number;
  onDomainChange: (v: string) => void;
  onKeywordsChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  onLanguageChange: (v: string) => void;
  onLimitChange: (v: number) => void;
  onSettingsOpen: () => void;
  onQueryStart: () => void;
  hasKeys: boolean;
  isQuerying: boolean;
}

export function RankerWorkspace({
  domain,
  keywords,
  country,
  language,
  limit,
  onDomainChange,
  onKeywordsChange,
  onCountryChange,
  onLanguageChange,
  onLimitChange,
  onSettingsOpen,
  onQueryStart,
  hasKeys,
  isQuerying,
}: RankerWorkspaceProps) {
  const t = useTranslations("keywordRanking");

  return (
    <section className="border-border bg-card relative overflow-hidden rounded-[2rem] border p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h3 className="mb-2 text-2xl font-bold tracking-tight">
            {t("workspace.title")}
          </h3>
        </div>
        <Button
          variant="outline"
          onClick={onSettingsOpen}
          className="cursor-pointer gap-2"
        >
          <Settings size={16} />
          {t("workspace.settings")}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Domain */}
        <div className="space-y-2">
          <label className="text-sm font-bold">{t("workspace.domain")}</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            placeholder="example.com"
            className="border-border bg-background/50 focus:border-primary focus:ring-primary/20 mt-2 h-12 w-full rounded-xl border px-4 transition-all outline-none focus:ring-4"
          />
        </div>

        {/* Keywords */}
        <div className="space-y-2">
          <label className="text-sm font-bold">{t("workspace.keywords")}</label>
          <textarea
            value={keywords}
            onChange={(e) => onKeywordsChange(e.target.value)}
            rows={5}
            placeholder="keyword..."
            className="border-border bg-background/50 focus:border-primary focus:ring-primary/20 mt-2 w-full resize-none rounded-xl border px-4 py-3 transition-all outline-none focus:ring-4"
          />
        </div>

        {/* Country / Language / Limit */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-bold">
              {t("workspace.country")}
            </label>
            <select
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              className="border-border bg-background/50 mt-2 h-12 w-full rounded-xl border px-4 outline-none"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">
              {t("workspace.language")}
            </label>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="border-border bg-background/50 mt-2 h-12 w-full rounded-xl border px-4 outline-none"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold">{t("workspace.limit")}</label>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="border-border bg-background/50 mt-2 h-12 w-full rounded-xl border px-4 outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={40}>40</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Run hint + Submit */}
        <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
          <div className="bg-muted/50 border-border flex-1 rounded-xl border p-4">
            <p className="text-muted-foreground mb-1 text-xs font-bold tracking-widest uppercase">
              Run hint
            </p>
            <p className="text-muted-foreground text-xs">
              {t("workspace.runHint")}
            </p>
          </div>
          <Button
            onClick={onQueryStart}
            disabled={!hasKeys || isQuerying}
            className="min-h-14 cursor-pointer gap-2 rounded-xl px-8 md:h-auto"
          >
            {isQuerying ? "..." : t("workspace.startQuery")}
            {!isQuerying && <ArrowUpRight size={18} />}
          </Button>
        </div>
      </div>
    </section>
  );
}
