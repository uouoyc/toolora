export const siteConfig = {
  name: "Toolora",
  defaultLocale: "zh-CN" as const,
  locales: ["zh-CN", "en"] as const,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolora.tools",
};

export type Locale = (typeof siteConfig.locales)[number];
