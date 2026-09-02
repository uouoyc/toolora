import type { MetadataRoute } from "next";

import { buildSitemapEntries, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemapEntries(SITE_URL);
}
