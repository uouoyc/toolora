import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "@toolora/api/context";
import { appRouter } from "@toolora/api/routers/index";
import { env } from "@toolora/env/server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

export const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError(() => {
      console.error("Unhandled oRPC error");
    }),
  ],
});

app.use("/*", async (context, next) => {
  const rpcResult = await rpcHandler.handle(context.req.raw, {
    prefix: "/rpc",
    context: createContext(),
  });

  if (rpcResult.matched) {
    return context.newResponse(rpcResult.response.body, rpcResult.response);
  }

  await next();
});

app.get("/", (context) => context.text("OK"));
