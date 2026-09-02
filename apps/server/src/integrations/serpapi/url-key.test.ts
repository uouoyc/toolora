import { describe, expect, it } from "vitest";
import { getUrlIdentity } from "./url-key";

describe("SERP URL identity", () => {
  it("rejects everything except parseable HTTP(S) URLs", () => {
    expect(getUrlIdentity("ftp://example.com/page")).toBeNull();
    expect(getUrlIdentity("mailto:support@example.com")).toBeNull();
    expect(getUrlIdentity("not a url")).toBeNull();
    expect(getUrlIdentity("")).toBeNull();
  });

  it("merges scheme, www, query, and fragment variants into one identity", () => {
    const identity = getUrlIdentity(
      "https://www.EXAMPLE.com/foo/?page=2&utm_source=google#section",
    );
    expect(identity).toBe("example.com/foo");
    expect(getUrlIdentity("http://example.com/foo?page=1")).toBe(
      "example.com/foo",
    );
    expect(getUrlIdentity("https://example.com/foo/?id=123")).toBe(
      "example.com/foo",
    );
    expect(getUrlIdentity("https://www.example.com/foo#top")).toBe(
      "example.com/foo",
    );
  });

  it("keeps query-less business paths distinct", () => {
    expect(getUrlIdentity("https://example.com/a")).toBe("example.com/a");
    expect(getUrlIdentity("https://example.com/b")).toBe("example.com/b");
    expect(getUrlIdentity("https://example.com/a/child")).toBe(
      "example.com/a/child",
    );
  });

  it("collapses repeated slashes and drops non-default ports", () => {
    expect(getUrlIdentity("https://example.com//foo///bar/")).toBe(
      "example.com/foo/bar",
    );
    expect(getUrlIdentity("https://example.com:8443/a")).toBe("example.com/a");
  });

  it("keeps the root path as slash", () => {
    expect(getUrlIdentity("https://www.example.com")).toBe("example.com/");
    expect(getUrlIdentity("https://example.com/")).toBe("example.com/");
  });

  it("strips default index documents case-insensitively", () => {
    expect(getUrlIdentity("https://example.com/index.html")).toBe(
      "example.com/",
    );
    expect(getUrlIdentity("https://example.com/INDEX.htm")).toBe(
      "example.com/",
    );
    expect(getUrlIdentity("https://example.com/index.php")).toBe(
      "example.com/",
    );
    expect(getUrlIdentity("https://example.com/foo/index.html")).toBe(
      "example.com/foo",
    );
  });

  it("keeps other subdomains distinct and drops only a leading www", () => {
    expect(getUrlIdentity("https://blog.example.com/a")).toBe(
      "blog.example.com/a",
    );
    expect(getUrlIdentity("https://wwwexample.com/a")).toBe("wwwexample.com/a");
  });

  it("preserves path case", () => {
    expect(getUrlIdentity("https://example.com/docs/Deep/Page")).toBe(
      "example.com/docs/Deep/Page",
    );
  });
});
