"use client";

import { useCallback, useMemo, useState } from "react";

import { useLocale } from "next-intl";

import { CategoryNav } from "@/components/category-nav";
import { SearchSection } from "@/components/search-section";
import { ToolGrid } from "@/components/tool-grid";
import { CATEGORIES_WITH_COUNTS, filterTools } from "@/lib/tools";

export function HomeView() {
  const locale = useLocale();
  const lang = locale === "zh-CN" ? "zh" : "en";

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredTools = useMemo(
    () => filterTools(activeCategory, searchQuery, lang),
    [activeCategory, searchQuery, lang],
  );

  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-7xl">
      <SearchSection value={searchQuery} onChange={setSearchQuery} />

      <div className="grid w-full grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <CategoryNav
          categories={CATEGORIES_WITH_COUNTS}
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
        />
        <ToolGrid
          categories={CATEGORIES_WITH_COUNTS}
          activeCategory={activeCategory}
          tools={filteredTools}
        />
      </div>
    </div>
  );
}
