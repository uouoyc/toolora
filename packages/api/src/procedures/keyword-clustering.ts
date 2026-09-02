import {
  KeywordClusteringBatchInputSchema,
  KeywordClusteringBatchOutputSchema,
} from "../contracts/keyword-clustering";
import { publicProcedure } from "../index";

export const keywordClusteringProcedures = {
  fetchBatch: publicProcedure
    .input(KeywordClusteringBatchInputSchema)
    .output(KeywordClusteringBatchOutputSchema)
    .handler(({ context, input }) =>
      context.serpApi.runKeywordClusteringBatch(input),
    ),
};
