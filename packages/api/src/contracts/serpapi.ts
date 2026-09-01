import { z } from "zod";

export const KeyStatusSchema = z.enum([
  "unchecked",
  "active",
  "invalid",
  "forbidden",
  "quota-exhausted",
  "rate-limited",
  "unknown",
]);

export const TooloraErrorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "INVALID_KEY",
  "KEY_FORBIDDEN",
  "RATE_LIMITED",
  "QUOTA_EXHAUSTED",
  "PROVIDER_UNAVAILABLE",
  "REQUEST_TIMEOUT",
  "UNKNOWN_PROVIDER_ERROR",
]);

export const SerpApiKeyInputSchema = z
  .object({
    id: z.uuid(),
    secret: z.string().trim().min(1).max(512),
  })
  .strict();

export const SerpApiCheckKeysInputSchema = z
  .object({
    keys: z.array(SerpApiKeyInputSchema).min(1),
  })
  .strict();

export const SerpApiKeyCheckSchema = z
  .object({
    accountId: z.string().nullable(),
    checkedAt: z.iso.datetime(),
    code: TooloraErrorCodeSchema.nullable(),
    hourlyLimit: z.number().nonnegative().nullable(),
    hourlyUsed: z.number().nonnegative().nullable(),
    monthlyLimit: z.number().nonnegative().nullable(),
    planName: z.string().nullable(),
    searchesLeft: z.number().nonnegative().nullable(),
    status: KeyStatusSchema,
  })
  .strict();

export const SerpApiCheckKeysOutputSchema = z
  .object({
    results: z.record(z.string(), SerpApiKeyCheckSchema),
  })
  .strict();

export type KeyStatus = z.infer<typeof KeyStatusSchema>;
export type SerpApiCheckKeysInput = z.infer<typeof SerpApiCheckKeysInputSchema>;
export type SerpApiCheckKeysOutput = z.infer<
  typeof SerpApiCheckKeysOutputSchema
>;
