# Build context: repo root (see docker-compose.yml). The API imports the
# workspace packages as TypeScript source and runs through tsx, so there is no
# build step and dev dependencies stay installed.
FROM node:24-bookworm-slim AS build
# Match packageManager in package.json; npm 11 honours "allowScripts".
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN npm install -g npm@11.20.0
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/solana/package.json packages/solana/
RUN npm ci --no-audit --no-fund

COPY packages packages
COPY apps/api apps/api
# Provision the same managed wallets/keys used by the deployed API.
COPY scripts/solana/package.json scripts/solana/setup-run.ts ./scripts/solana/
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /app ./
ENV NODE_ENV=production
WORKDIR /app/apps/api
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["/app/node_modules/.bin/tsx", "src/index.ts"]
