import type { RouterClient } from "@orpc/server";
import {
  SerpApiCheckKeysInputSchema,
  SerpApiCheckKeysOutputSchema,
} from "../contracts/serpapi";
import { publicProcedure } from "../index";
import { keywordClusteringProcedures } from "../procedures/keyword-clustering";
import { keywordRankingProcedures } from "../procedures/keyword-ranking";

export const appRouter = {
  healthCheck: publicProcedure.handler(() => {
    return "OK";
  }),
  serpApi: {
    checkKeys: publicProcedure
      .input(SerpApiCheckKeysInputSchema)
      .output(SerpApiCheckKeysOutputSchema)
      .handler(({ context, input }) => context.serpApi.checkKeys(input.keys)),
  },
  keywordClustering: keywordClusteringProcedures,
  keywordRanking: keywordRankingProcedures,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
