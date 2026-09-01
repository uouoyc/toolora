import { describe, expect, it } from "vitest";
import {
  isSerpApiCountry,
  isSerpApiLanguage,
  SERPAPI_COUNTRIES,
  SERPAPI_LANGUAGES,
} from "./locales";

describe("SerpAPI locale snapshots", () => {
  it("exposes the complete official country list", () => {
    expect(SERPAPI_COUNTRIES).toHaveLength(244);
    expect(SERPAPI_COUNTRIES).toContainEqual({
      country_code: "us",
      country_name: "United States",
    });
    const codes = SERPAPI_COUNTRIES.map((entry) => entry.country_code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toBe(code.toLowerCase());
      expect(code).toMatch(/^[a-z]{2}$/);
    }
  });

  it("exposes the curated language list without xx-* placeholders", () => {
    expect(SERPAPI_LANGUAGES.length).toBeGreaterThan(100);
    const codes = SERPAPI_LANGUAGES.map((entry) => entry.language_code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toBe(code.toLowerCase());
      expect(code).not.toMatch(/^xx/);
    }
  });

  it("validates multi-part language codes against snapshot membership", () => {
    for (const code of [
      "zh-cn",
      "zh-tw",
      "pt-br",
      "pt-pt",
      "sr-me",
      "es-419",
    ]) {
      expect(isSerpApiLanguage(code)).toBe(true);
    }
    expect(isSerpApiLanguage("en")).toBe(true);
    expect(isSerpApiLanguage("zz")).toBe(false);
    expect(isSerpApiLanguage("en-US")).toBe(false);
    expect(isSerpApiLanguage("english")).toBe(false);
  });

  it("validates country membership with the exact official codes", () => {
    expect(isSerpApiCountry("us")).toBe(true);
    expect(isSerpApiCountry("gb")).toBe(true);
    expect(isSerpApiCountry("zz")).toBe(false);
    expect(isSerpApiCountry("usa")).toBe(false);
    expect(isSerpApiCountry("US")).toBe(false);
  });
});
