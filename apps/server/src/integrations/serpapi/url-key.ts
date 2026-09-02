const INDEX_DOCUMENT = /\/(?:index\.(?:html?|php))$/i;

/**
 * SERP URL identity: the page is its host plus its path, nothing else.
 * Scheme, port, `www.`, the entire query string, and the fragment are not
 * part of page identity — tracking parameters (gclid, gbraid, gad_source,
 * utm_*, …) and business parameters alike collapse onto the same page.
 * Slashes collapse, a trailing slash is dropped (the root stays `/`), and
 * default index documents fold into their directory. Returns null for
 * anything that is not a parseable HTTP(S) URL.
 */
export function getUrlIdentity(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  const host = hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  let pathname = url.pathname
    .replace(/\/+/g, "/")
    .replace(INDEX_DOCUMENT, "")
    .replace(/\/+$/, "");
  if (!pathname) {
    pathname = "/";
  }

  return `${host}${pathname}`;
}
