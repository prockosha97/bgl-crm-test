FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
RUN --mount=type=secret,id=build_ca,required=false if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; npm ci && npx prisma generate
COPY . .
RUN npm run build

FROM build AS production-deps
RUN --mount=type=secret,id=build_ca,required=false if [ -f /run/secrets/build_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/build_ca; fi; npm ci --omit=dev --no-audit && npx prisma generate

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json
# Prisma CLI is retained separately for migrate deploy, not downloaded at runtime.
COPY --from=build /app/scripts/entrypoint.sh ./entrypoint.sh
RUN mkdir -p /data/media && chown -R node:node /data /app
USER node
ENV NODE_ENV=production PORT=80 MEDIA_ROOT=/data/media
EXPOSE 80
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
