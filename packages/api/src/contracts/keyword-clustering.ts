import { z } from "zod";

import {
  CountrySchema,
  keywordListSchema,
  LanguageSchema,
  TargetDomainSchema,
} from "./keywords";
import { SerpApiKeyInputSchema, TooloraErrorCodeSchema } from "./serpapi";

export const KeywordClusteringInputSchema = z
  .object({
    country: CountrySchema,
    groupingAccuracy: z.number().int().min(1).max(10).default(4),
    keywords: keywordListSchema(1000),
    language: LanguageSchema,
    targetDomain: TargetDomainSchema.nullable().default(null),
  })
  .strict();

export const KeywordClusteringBatchInputSchema = z
  .object({
    country: CountrySchema,
    key: SerpApiKeyInputSchema,
    keywords: keywordListSchema(5),
    language: LanguageSchema,
  })
  .strict();

const KeywordClusteringResultBaseSchema = z.object({
  keyword: z.string().min(1),
});

/** One organic result: the raw SERP URL plus its page identity. */
export const SerpEvidenceUrlSchema = z
  .object({
    url: z.url(),
    urlIdentity: z.string().min(1).max(2048),
  })
  .strict();

export const KeywordClusteringResultSchema = z.discriminatedUnion("status", [
  KeywordClusteringResultBaseSchema.extend({
    errorCode: z.null(),
    fetchedAt: z.iso.datetime(),
    status: z.literal("evidence-ready"),
    urls: z.array(SerpEvidenceUrlSchema).min(1).max(10),
  }),
  KeywordClusteringResultBaseSchema.extend({
    errorCode: z.null(),
    fetchedAt: z.iso.datetime(),
    status: z.literal("no-evidence"),
    urls: z.array(SerpEvidenceUrlSchema).max(0),
  }),
  KeywordClusteringResultBaseSchema.extend({
    errorCode: TooloraErrorCodeSchema,
    fetchedAt: z.null(),
    status: z.literal("failed"),
    urls: z.array(SerpEvidenceUrlSchema).max(0),
  }),
]);

export const KeywordClusteringFailureSchema = z
  .object({
    errorCode: TooloraErrorCodeSchema,
    httpStatus: z.number().int().min(100).max(599).nullable(),
    keyword: z.string().min(1),
  })
  .strict();

export const KeywordClusteringBatchOutputSchema = z
  .object({
    failures: z.array(KeywordClusteringFailureSchema).max(5),
    results: z.array(KeywordClusteringResultSchema).max(5),
  })
  .strict();

export type KeywordClusteringBatchInput = z.infer<
  typeof KeywordClusteringBatchInputSchema
>;
export type KeywordClusteringBatchOutput = z.infer<
  typeof KeywordClusteringBatchOutputSchema
>;
export type KeywordClusteringFailure = z.infer<
  typeof KeywordClusteringFailureSchema
>;
export type KeywordClusteringInput = z.infer<
  typeof KeywordClusteringInputSchema
>;
export type KeywordClusteringResult = z.infer<
  typeof KeywordClusteringResultSchema
>;
export type SerpEvidenceUrl = z.infer<typeof SerpEvidenceUrlSchema>;
