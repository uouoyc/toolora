const SEARCH_URL = "https://serpapi.com/search.json";

/**
 * Fixed Google Light engine request shared by keyword Tools. SerpAPI accepts
 * the Key only as this server-side query parameter.
 */
export function buildGoogleLightSearchUrl({
  gl,
  hl,
  q,
  secret,
  start = 0,
}: {
  gl: string;
  hl: string;
  q: string;
  secret: string;
  start?: number;
}) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("api_key", secret);
  url.searchParams.set("engine", "google_light");
  url.searchParams.set("gl", gl);
  url.searchParams.set("hl", hl);
  url.searchParams.set("q", q);
  url.searchParams.set("start", String(start));
  return url;
}
