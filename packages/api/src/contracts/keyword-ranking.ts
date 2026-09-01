import { z } from "zod";

import { SerpApiKeyInputSchema, TooloraErrorCodeSchema } from "./serpapi";

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

const TargetDomainSchema = z
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

function keywordListSchema(max: number) {
  return z
    .array(z.string().max(512))
    .min(1)
    .max(10_000)
    .transform(normalizeKeywords)
    .refine((keywords) => keywords.length > 0 && keywords.length <= max, {
      message: `Provide between 1 and ${max} normalized keywords`,
    });
}

const CountrySchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[a-z0-9]{1,8})?$/i)
  .transform((value) => value.toLowerCase());

const LanguageSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2}(-[a-z0-9]{1,8})?$/i)
  .transform((value) => value.toLowerCase());

export const SearchDepthSchema = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(30),
  z.literal(40),
  z.literal(50),
]);

export const KeywordRankingInputSchema = z
  .object({
    country: CountrySchema,
    keywords: keywordListSchema(1000),
    language: LanguageSchema,
    searchDepth: SearchDepthSchema,
    targetDomain: TargetDomainSchema,
  })
  .strict();

export const KeywordRankingBatchInputSchema = KeywordRankingInputSchema.extend({
  key: SerpApiKeyInputSchema,
  keywords: keywordListSchema(5),
});

const KeywordRankingResultBaseSchema = z.object({
  keyword: z.string().min(1),
});

export const KeywordRankingResultSchema = z.discriminatedUnion("status", [
  KeywordRankingResultBaseSchema.extend({
    errorCode: z.null(),
    fetchedAt: z.iso.datetime(),
    rank: z.number().int().positive(),
    status: z.literal("found"),
    url: z.url(),
  }),
  KeywordRankingResultBaseSchema.extend({
    errorCode: z.null(),
    fetchedAt: z.iso.datetime(),
    rank: z.null(),
    status: z.literal("not-found"),
    url: z.null(),
  }),
  KeywordRankingResultBaseSchema.extend({
    errorCode: TooloraErrorCodeSchema,
    fetchedAt: z.null(),
    rank: z.null(),
    status: z.literal("failed"),
    url: z.null(),
  }),
]);

export const KeywordRankingFailureSchema = z
  .object({
    errorCode: TooloraErrorCodeSchema,
    httpStatus: z.number().int().min(100).max(599).nullable(),
    keyword: z.string().min(1),
  })
  .strict();

export const KeywordRankingBatchOutputSchema = z
  .object({
    failures: z.array(KeywordRankingFailureSchema).max(5),
    results: z.array(KeywordRankingResultSchema).max(5),
  })
  .strict();

export type KeywordRankingBatchInput = z.infer<
  typeof KeywordRankingBatchInputSchema
>;
export type KeywordRankingBatchOutput = z.infer<
  typeof KeywordRankingBatchOutputSchema
>;
export type KeywordRankingInput = z.infer<typeof KeywordRankingInputSchema>;
export type KeywordRankingFailure = z.infer<typeof KeywordRankingFailureSchema>;
export type KeywordRankingResult = z.infer<typeof KeywordRankingResultSchema>;
