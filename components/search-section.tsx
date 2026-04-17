"use client";

import { useEffect, useRef } from "react";

import { useTranslations } from "next-intl";

import { ArrowUpRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchSectionProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchSection({ value, onChange }: SearchSectionProps) {
  const t = useTranslations("home");
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl+K / Cmd+K to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section className="mb-12">
      <div className="border-border bg-card/50 relative overflow-hidden rounded-[2rem] border p-6 sm:p-8">
        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-[200px_1fr_140px]">
          {/* Command hint */}
          <div className="border-border bg-background/50 hidden flex-col justify-center rounded-2xl border px-6 py-3 md:flex">
            <span className="text-muted-foreground mb-1 font-mono text-[10px] tracking-widest uppercase">
              {t("command")}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight">
                {t("searchRack")}
              </span>
            </div>
            <span className="text-muted-foreground mt-1 font-mono text-[10px]">
              {t("commandHint")}
            </span>
          </div>

          {/* Search input */}
          <div className="group relative">
            <div className="text-muted-foreground group-focus-within:text-primary pointer-events-none absolute inset-y-0 left-4 flex items-center transition-colors">
              <Search size={20} />
            </div>
            <Input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="border-border bg-background/80 focus:bg-background focus:ring-primary/10 focus:border-primary h-full min-h-13 w-full rounded-2xl border pr-4 pl-12 text-lg font-medium transition-all outline-none focus:ring-4"
            />
          </div>

          {/* Search button */}
          <Button
            onClick={() => inputRef.current?.focus()}
            className="h-full min-h-13 cursor-pointer gap-2 rounded-2xl"
          >
            {t("searchBtn")}
            <ArrowUpRight size={18} />
          </Button>
        </div>
      </div>
    </section>
  );
}
