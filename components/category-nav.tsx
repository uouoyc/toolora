"use client";

import { memo } from "react";

import { useLocale } from "next-intl";

import type { Category, Language } from "@/lib/tools";

interface CategoryButtonProps {
  cat: Category;
  lang: Language;
  isActive: boolean;
  onCategoryChange: (categoryId: string) => void;
}

const CategoryButton = memo(function CategoryButton({
  cat,
  lang,
  isActive,
  onCategoryChange,
}: CategoryButtonProps) {
  const Icon = cat.icon;

  return (
    <button
      onClick={() => onCategoryChange(cat.id)}
      className={`group flex w-full cursor-pointer items-center justify-between rounded-xl p-3 transition-all ${
        isActive
          ? "bg-primary text-primary-foreground shadow-primary/20 shadow-lg"
          : "hover:bg-accent text-muted-foreground hover:text-foreground"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            isActive
              ? "bg-primary-foreground/10"
              : "bg-muted group-hover:bg-background"
          }`}
        >
          <Icon size={16} />
        </div>
        <span className="text-sm font-semibold">{cat.label[lang]}</span>
      </div>
      <span
        className={`font-mono text-[10px] ${
          isActive ? "opacity-70" : "text-muted-foreground"
        }`}
      >
        {cat.count > 99 ? "99+" : cat.count.toString().padStart(2, "0")}
      </span>
    </button>
  );
});

interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export function CategoryNav({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryNavProps) {
  const locale = useLocale();
  const lang: Language = locale === "zh-CN" ? "zh" : "en";

  return (
    <aside className="space-y-2">
      <div className="space-y-1 lg:sticky lg:top-8">
        {categories.map((cat) => (
          <CategoryButton
            key={cat.id}
            cat={cat}
            lang={lang}
            isActive={activeCategory === cat.id}
            onCategoryChange={onCategoryChange}
          />
        ))}
      </div>
    </aside>
  );
}
