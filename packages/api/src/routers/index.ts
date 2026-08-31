import type { RouterClient } from "@orpc/server";

import {
  SerpApiCheckKeysInputSchema,
  SerpApiCheckKeysOutputSchema,
} from "../contracts/serpapi";
import { publicProcedure } from "../index";

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
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
