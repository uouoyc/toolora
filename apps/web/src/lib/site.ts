import type { MetadataRoute } from "next";

import { TOOLS } from "./tools";

/** Local origin used when no site URL is configured (the web app dev port). */
export const LOCAL_SITE_URL = "http://localhost:3001";

/**
 * Absolute site origin for canonical URLs, sitemap, and robots. Controlled by
 * `NEXT_PUBLIC_SITE_URL`; absence means a local run.
 */
export function resolveSiteUrl(envUrl: string | undefined): string {
  const trimmed = envUrl?.trim();
  if (!trimmed) {
    return LOCAL_SITE_URL;
  }
  return trimmed.replace(/\/+$/, "");
}

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

/** Joins a root-relative path onto the site origin. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildSitemapEntries(siteUrl: string): MetadataRoute.Sitemap {
  return [
    // Root is emitted without a trailing slash to match Next's canonical
    // normalization of the homepage URL.
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    ...TOOLS.map((tool) => ({
      url: `${siteUrl}/${tool.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}

export function buildRobots(siteUrl: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
