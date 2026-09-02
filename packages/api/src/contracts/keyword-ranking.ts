import { z } from "zod";

import {
  CountrySchema,
  keywordListSchema,
  LanguageSchema,
  normalizeKeywords,
  normalizeTargetDomain,
  TargetDomainSchema,
} from "./keywords";
import { SerpApiKeyInputSchema, TooloraErrorCodeSchema } from "./serpapi";

export { normalizeKeywords, normalizeTargetDomain };

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
