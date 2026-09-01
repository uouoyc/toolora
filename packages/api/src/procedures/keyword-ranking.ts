import {
  KeywordRankingBatchInputSchema,
  KeywordRankingBatchOutputSchema,
} from "../contracts/keyword-ranking";
import { publicProcedure } from "../index";

export const keywordRankingProcedures = {
  runBatch: publicProcedure
    .input(KeywordRankingBatchInputSchema)
    .output(KeywordRankingBatchOutputSchema)
    .handler(({ context, input }) =>
      context.serpApi.runKeywordRankingBatch(input),
    ),
};
