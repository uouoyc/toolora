import { cache } from "react";

import { type Locale, siteConfig } from "@/configs/site";

type Messages = Record<string, unknown>;

const bundles = ["common", "home"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(target: Messages, source: Messages): Messages {
  const output: Messages = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const existing = output[key];

    if (isRecord(existing) && isRecord(value)) {
      output[key] = deepMerge(existing, value);
      continue;
    }

    output[key] = value;
  }

  return output;
}

export function isLocale(value: string): value is Locale {
  return siteConfig.locales.includes(value as Locale);
}

export function resolveLocale(value: string | undefined): Locale {
  if (!value) {
    return siteConfig.defaultLocale;
  }

  if (isLocale(value)) {
    return value;
  }

  return siteConfig.defaultLocale;
}

export const loadMessages = cache(async (locale: Locale): Promise<Messages> => {
  let merged: Messages = {};

  for (const bundle of bundles) {
    const messageBundle = await import(`../messages/${locale}/${bundle}.json`);
    merged = deepMerge(merged, messageBundle.default as Messages);
  }

  return merged;
});

export function getMessage(messages: Messages, key: string): string {
  const value = key.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }

    return current[segment];
  }, messages);

  if (typeof value !== "string") {
    throw new Error(`Missing message for key: ${key}`);
  }

  return value;
}
