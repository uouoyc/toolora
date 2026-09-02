import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  buildRobots,
  buildSitemapEntries,
  LOCAL_SITE_URL,
  resolveSiteUrl,
  SITE_URL,
} from "./site";
import { TOOLS } from "./tools";

describe("resolveSiteUrl", () => {
  it("falls back to the local origin when no site URL is configured", () => {
    expect(resolveSiteUrl(undefined)).toBe(LOCAL_SITE_URL);
    expect(resolveSiteUrl("")).toBe(LOCAL_SITE_URL);
    expect(resolveSiteUrl("   ")).toBe(LOCAL_SITE_URL);
  });

  it("trims and strips trailing slashes from a configured site URL", () => {
    expect(resolveSiteUrl(" https://example.com ")).toBe("https://example.com");
    expect(resolveSiteUrl("https://example.com/")).toBe("https://example.com");
    expect(resolveSiteUrl("https://example.com//")).toBe("https://example.com");
  });
});

describe("SITE_URL", () => {
  it("always resolves from the current environment value", () => {
    expect(SITE_URL).toBe(resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL));
    expect(SITE_URL).toMatch(/^https?:\/\//);
  });
});

describe("absoluteUrl", () => {
  it("joins root-relative paths onto the given origin", () => {
    expect(absoluteUrl("/keyword-ranking")).toBe(`${SITE_URL}/keyword-ranking`);
    expect(absoluteUrl("/")).toBe(`${SITE_URL}/`);
  });

  it("normalizes paths without a leading slash", () => {
    expect(absoluteUrl("keyword-ranking")).toBe(`${SITE_URL}/keyword-ranking`);
  });
});

describe("buildSitemapEntries", () => {
  const entries = buildSitemapEntries("https://example.com");

  it("lists the homepage and every Tool route exactly once", () => {
    const urls = entries.map(({ url }) => url);
    expect(urls).toEqual([
      "https://example.com",
      ...TOOLS.map(({ slug }) => `https://example.com/${slug}`),
    ]);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("ranks the homepage above Tool routes", () => {
    expect(entries[0]).toMatchObject({
      url: "https://example.com",
      priority: 1,
    });
    for (const entry of entries.slice(1)) {
      expect(entry.priority).toBeLessThan(1);
      expect(entry.changeFrequency).toBeDefined();
    }
  });
});

describe("buildRobots", () => {
  it("allows all crawlers and references the sitemap", () => {
    expect(buildRobots("https://example.com")).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://example.com/sitemap.xml",
    });
  });
});
