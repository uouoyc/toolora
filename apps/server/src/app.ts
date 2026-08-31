import { RPCHandler } from "@orpc/server/fetch";
import { createContext } from "@toolora/api/context";
import { appRouter } from "@toolora/api/routers/index";
import { env } from "@toolora/env/server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";

import { serpApiClient } from "./integrations/serpapi/client";

export const app = new Hono<{
  Variables: { tooloraCode: string | null };
}>();

app.use("*", async (context, next) => {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  context.set("tooloraCode", null);
  await next();
  console.info(
    JSON.stringify({
      durationMs: Math.round(performance.now() - startedAt),
      procedure: context.req.path,
      requestId,
      status: context.res.status,
      tooloraCode: context.get("tooloraCode"),
    }),
  );
});

app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use(
  "/rpc/*",
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (context) => {
      context.set("tooloraCode", "VALIDATION_ERROR");
      return context.json({ code: "VALIDATION_ERROR" }, { status: 413 });
    },
  }),
);

const rpcHandler = new RPCHandler(appRouter);

app.use("/*", async (context, next) => {
  const rpcResult = await rpcHandler.handle(context.req.raw, {
    prefix: "/rpc",
    context: createContext({ serpApi: serpApiClient }),
  });

  if (rpcResult.matched) {
    if (rpcResult.response.status === 400) {
      context.set("tooloraCode", "VALIDATION_ERROR");
      return context.json(
        {
          json: {
            code: "VALIDATION_ERROR",
            defined: false,
            message: "Input validation failed",
            status: 400,
          },
        },
        400,
      );
    }
    return context.newResponse(rpcResult.response.body, rpcResult.response);
  }

  await next();
});

app.get("/", (context) => context.text("OK"));
