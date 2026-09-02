import { z } from "zod";

const HostnameSchema = z.string().min(1).max(253);

export function normalizeKeywords(keywords: readonly string[]) {
  const seen = new Set<string>();

  return keywords.flatMap((keyword) => {
    const normalized = keyword
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return [];
    }
    seen.add(normalized);
    return [normalized];
  });
}

export function normalizeTargetDomain(value: string) {
  const candidate = value.trim();
  if (/^[a-z][a-z\d+.-]*:/i.test(candidate) && !/^https?:/i.test(candidate)) {
    throw new Error("Target Domain must use HTTP or HTTPS");
  }
  const URLConstructor = (
    globalThis as unknown as {
      URL: new (value: string) => { hostname: string; protocol: string };
    }
  ).URL;
  const url = new URLConstructor(
    /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
  );
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Target Domain must use HTTP or HTTPS");
  }

  return url.hostname
    .normalize("NFC")
    .toLowerCase()
    .replace(/^www\./, "");
}

export const TargetDomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(
    (value) => {
      try {
        return Boolean(normalizeTargetDomain(value));
      } catch {
        return false;
      }
    },
    { message: "Target Domain must be a hostname or HTTP(S) URL" },
  )
  .transform(normalizeTargetDomain)
  .pipe(HostnameSchema);

export function keywordListSchema(max: number) {
  return z
    .array(z.string().max(512))
    .min(1)
    .max(10_000)
    .transform(normalizeKeywords)
    .refine((keywords) => keywords.length > 0 && keywords.length <= max, {
      message: `Provide between 1 and ${max} normalized keywords`,
    });
}

export const CountrySchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[a-z0-9]{1,8})?$/i)
  .transform((value) => value.toLowerCase());

export const LanguageSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[a-z0-9]{1,8})?$/i)
  .transform((value) => value.toLowerCase());
