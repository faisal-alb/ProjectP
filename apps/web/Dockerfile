# Build context: repo root (see docker-compose.yml).
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
COPY apps/web apps/web
# NEXT_PUBLIC_* values are inlined into the browser bundle, so they must be
# known here, at build time.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MAPBOX_TOKEN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    NEXT_TELEMETRY_DISABLED=1
# better-auth refuses its default secret in production, and collecting page
# data loads it. This placeholder only exists in the build stage; the real
# secret comes from the runtime environment. The build also creates auth.db,
# which is dropped so the mounted volume starts clean.
RUN BETTER_AUTH_SECRET=build-stage-placeholder-not-used-at-runtime npm run build -w web \
  && rm -rf apps/web/.data

FROM node:24-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
WORKDIR /app
COPY --from=build /app ./
# auth.db is opened relative to the working directory: /app/apps/web/.data.
WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["/app/apps/web/node_modules/.bin/next", "start", "-p", "3000"]
