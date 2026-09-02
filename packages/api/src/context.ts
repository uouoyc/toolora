import type {
  KeywordClusteringBatchInput,
  KeywordClusteringBatchOutput,
} from "./contracts/keyword-clustering";
import type {
  KeywordRankingBatchInput,
  KeywordRankingBatchOutput,
} from "./contracts/keyword-ranking";
import type {
  SerpApiCheckKeysInput,
  SerpApiCheckKeysOutput,
} from "./contracts/serpapi";

export type SerpApiClient = {
  checkKeys: (
    keys: SerpApiCheckKeysInput["keys"],
  ) => Promise<SerpApiCheckKeysOutput>;
  runKeywordRankingBatch: (
    input: KeywordRankingBatchInput,
  ) => Promise<KeywordRankingBatchOutput>;
  runKeywordClusteringBatch: (
    input: KeywordClusteringBatchInput,
  ) => Promise<KeywordClusteringBatchOutput>;
};

export function createContext({ serpApi }: { serpApi: SerpApiClient }) {
  return { serpApi };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
