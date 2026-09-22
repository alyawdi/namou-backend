# better-sqlite3 is a native module, so the build stage needs a toolchain.
# The runtime image gets the already-compiled node_modules and no compiler.
FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY package.json ./
COPY start.sh ./
RUN chmod +x start.sh

USER node
EXPOSE 8080

# Migrate and seed before serving. Fly release commands don't mount the volume,
# so boot is the only point where the database file is actually reachable.
CMD ["/app/start.sh"]
