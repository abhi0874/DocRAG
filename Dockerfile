# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS migration
COPY db ./db
COPY docker/migrate.mjs ./docker/migrate.mjs
USER node
CMD ["node", "docker/migrate.mjs"]

FROM dependencies AS build
COPY . .
RUN pnpm build && mkdir -p /app/runtime-cache

# Use the accepted Node binary with distroless system libraries and CA certificates.
FROM gcr.io/distroless/cc-debian13:nonroot@sha256:cb87acc574abe719b6e5c547384defa2f7b1f24af9605d3f618cf852495d8be2 AS runtime
COPY --from=dependencies /usr/local/bin/node /usr/bin/node
COPY --from=dependencies /usr/local/LICENSE /usr/share/doc/node/LICENSE
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 RERANKER_ENABLED=false
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build --chown=65532:65532 /app/runtime-cache/ ./.next/cache/
USER 65532:65532
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
