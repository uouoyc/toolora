import type { LucideIcon } from "lucide-react";
import { LayoutGrid, SearchCheck } from "lucide-react";

export type Language = "zh" | "en";

export interface Tool {
  id: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
  category: string;
  tags: string[];
}

export interface Category {
  id: string;
  label: Record<Language, string>;
  icon: LucideIcon;
  count: number;
}

export const CATEGORIES: Category[] = [
  {
    id: "all",
    label: { zh: "全部工具", en: "All Tools" },
    icon: LayoutGrid,
    count: 0,
  },
  {
    id: "SEO",
    label: { zh: "SEO 优化", en: "SEO" },
    icon: SearchCheck,
    count: 0,
  },
];

const TOOLS: Tool[] = [
  {
    id: "keyword-ranking",
    title: {
      zh: "关键词排名查询",
      en: "Keyword Ranker",
    },
    description: {
      zh: "批量查询关键词排名，提供快速的 SERP 快照和分组位置。",
      en: "Batch keyword ranking with quick SERP snapshots and grouped positions.",
    },
    category: "SEO",
    tags: ["SEO", "SERP"],
  },
];

const toolCounts: Record<string, number> = {};
for (const tool of TOOLS) {
  toolCounts[tool.category] = (toolCounts[tool.category] ?? 0) + 1;
}

export const CATEGORIES_WITH_COUNTS: Category[] = CATEGORIES.map((cat) => ({
  ...cat,
  count: cat.id === "all" ? TOOLS.length : (toolCounts[cat.id] ?? 0),
}));

export function filterTools(
  category: string,
  searchQuery: string,
  lang: Language,
): Tool[] {
  return TOOLS.filter((tool) => {
    const matchesCategory = category === "all" || tool.category === category;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      tool.title[lang].toLowerCase().includes(q) ||
      tool.description[lang].toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
}
