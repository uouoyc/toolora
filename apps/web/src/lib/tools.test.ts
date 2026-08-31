import { describe, expect, it } from "vitest";

import { filterTools, splitHighlightSegments, TOOLS } from "./tools";

describe("Tool Catalog", () => {
  it("contains complete, unique, lowercase kebab-case Tool metadata", () => {
    expect(TOOLS).toHaveLength(2);
    expect(new Set(TOOLS.map(({ slug }) => slug)).size).toBe(TOOLS.length);

    for (const tool of TOOLS) {
      expect(tool.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(tool.name).not.toBe("");
      expect(tool.description).not.toBe("");
      expect(tool.category).toBe("SEO 优化");
    }
  });

  it("searches name and description without treating category as searchable text", () => {
    expect(filterTools(TOOLS, { query: "SERP", category: null })).toEqual([
      expect.objectContaining({ slug: "keyword-ranking" }),
    ]);
    expect(filterTools(TOOLS, { query: "聚类", category: null })).toEqual([
      expect.objectContaining({ slug: "keyword-clustering" }),
    ]);
    expect(filterTools(TOOLS, { query: "SEO 优化", category: null })).toEqual(
      [],
    );
  });

  it("combines search with a category filter", () => {
    expect(
      filterTools(TOOLS, { query: "关键词", category: "SEO 优化" }),
    ).toHaveLength(2);
    expect(
      filterTools(TOOLS, { query: "关键词", category: null }),
    ).toHaveLength(2);
  });

  it("splits every case-insensitive match without HTML injection", () => {
    expect(splitHighlightSegments("SERP 与 serp 结果", "serp")).toEqual([
      { text: "SERP", match: true },
      { text: " 与 ", match: false },
      { text: "serp", match: true },
      { text: " 结果", match: false },
    ]);
  });
});
