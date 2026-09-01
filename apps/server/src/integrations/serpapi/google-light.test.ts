import { describe, expect, it } from "vitest";
import { buildGoogleLightSearchUrl } from "./google-light";

describe("Google Light search URL", () => {
  it("builds the fixed engine request with locale and pagination", () => {
    const url = buildGoogleLightSearchUrl({
      gl: "us",
      hl: "en",
      q: "running shoes",
      secret: "server-side-secret",
      start: 10,
    });

    expect(url.origin).toBe("https://serpapi.com");
    expect(url.pathname).toBe("/search.json");
    expect(url.searchParams.get("api_key")).toBe("server-side-secret");
    expect(url.searchParams.get("engine")).toBe("google_light");
    expect(url.searchParams.get("gl")).toBe("us");
    expect(url.searchParams.get("hl")).toBe("en");
    expect(url.searchParams.get("q")).toBe("running shoes");
    expect(url.searchParams.get("start")).toBe("10");
  });

  it("defaults pagination to the first results page", () => {
    const url = buildGoogleLightSearchUrl({
      gl: "zh-cn",
      hl: "zh-cn",
      q: "关键词",
      secret: "server-side-secret",
    });

    expect(url.searchParams.get("start")).toBe("0");
  });
});
