import type { SerpApiCheckKeysOutput } from "@toolora/api/contracts/serpapi";

/** Stable Toolora error codes shared by keyword Tools, anchored to the public contract. */
export type RunErrorCode = NonNullable<
  SerpApiCheckKeysOutput["results"][string]["code"]
>;

/** A Key Pool entry as seen by one Run. */
export type RunKey = {
  id: string;
  secret: string;
  accountId?: string | null;
  status?: string;
};

/** One entry of a Tool's failed queue. */
export type RunFailure = {
  attemptedKeyIds: string[];
  errorCode: RunErrorCode;
  httpStatus: number | null;
  keyword: string;
};

/** A five-keyword browser batch assigned to one Key. */
export type KeywordBatch = {
  keyId: string;
  keywords: string[];
};

/** Per-keyword failure detail returned by a batch procedure alongside results. */
export type BatchExecuteFailure = {
  errorCode: RunErrorCode;
  httpStatus: number | null;
  keyword: string;
};

/**
 * Minimal result contract shared by keyword Runs: `errorCode` is non-null if
 * and only if the keyword failed, mirroring every Tool result schema.
 */
export type KeywordRunResult = {
  errorCode: RunErrorCode | null;
  keyword: string;
};
