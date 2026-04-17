import { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteConfig.siteUrl;
  const locales = siteConfig.locales;

  const routes = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    {
      path: "keyword-ranking",
      priority: 0.8,
      changeFrequency: "weekly" as const,
    },
  ];

  return locales.flatMap((locale) =>
    routes.map((route) => {
      const prefix = locale === "zh-CN" ? "" : `/${locale}`;
      const path = route.path ? `/${route.path}` : "";

      return {
        url: `${baseUrl}${prefix}${path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority,
      };
    }),
  );
}
