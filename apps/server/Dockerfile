FROM node:24-slim AS builder
RUN npm install -g pnpm@11
WORKDIR /app
ENV SKIP_ENV_VALIDATION=1

COPY . .
RUN --mount=type=cache,target=/pnpm-store pnpm install --store-dir /pnpm-store

ENV NODE_ENV=production
RUN cd apps/server && pnpm run build

# Self-contained production deployment for the runner. The bundle inlines
# @toolora/* already, so the copied workspace links are dropped.
RUN pnpm --filter=server deploy --prod --legacy /deploy \
  && rm -rf /deploy/node_modules/@toolora \
  && cp -r apps/server/dist /deploy/dist

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /deploy ./

EXPOSE 3000

CMD ["node", "dist/index.mjs"]
