export type ToolCategory = "SEO 优化";

export type ToolManifestItem = {
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  tags: readonly string[];
};

export const TOOLS = [
  {
    slug: "keyword-ranking",
    name: "关键词排名查询",
    description: "批量查询关键词排名，快速定位目标域名的 SERP 位置。",
    category: "SEO 优化",
    tags: ["SEO", "SERP"],
  },
  {
    slug: "keyword-clustering",
    name: "关键词聚类",
    description: "根据 Google 搜索结果重叠，将适合共用页面的关键词整理为聚类。",
    category: "SEO 优化",
    tags: ["SEO", "SERP"],
  },
] as const satisfies readonly ToolManifestItem[];

export function filterTools(
  tools: readonly ToolManifestItem[],
  filters: { query: string; category: ToolCategory | null },
): ToolManifestItem[] {
  const query = filters.query.trim().toLowerCase();

  return tools.filter((tool) => {
    if (filters.category && tool.category !== filters.category) {
      return false;
    }

    return (
      !query ||
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  });
}

export function splitHighlightSegments(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [{ text, match: false }];
  }

  const normalizedText = text.toLowerCase();
  const segments: Array<{ text: string; match: boolean }> = [];
  let offset = 0;

  while (offset < text.length) {
    const matchStart = normalizedText.indexOf(normalizedQuery, offset);
    if (matchStart === -1) {
      segments.push({ text: text.slice(offset), match: false });
      break;
    }

    if (matchStart > offset) {
      segments.push({ text: text.slice(offset, matchStart), match: false });
    }
    const matchEnd = matchStart + normalizedQuery.length;
    segments.push({ text: text.slice(matchStart, matchEnd), match: true });
    offset = matchEnd;
  }

  return segments;
}
