# syntax=docker/dockerfile:1
# VetNexa API. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t vetnexa-api .
#
# Stages:
#   build    – installs all packages and bundles the API into dist/server.js
#   migrate  – applies database migrations (used by the "migrate" service in Compose)
#   runtime  – production image: only runtime packages and the bundle, runs as a non-root user

ARG NODE_IMAGE=node:24-bookworm-slim

# ── build ──
FROM ${NODE_IMAGE} AS build
WORKDIR /app
# Manifests first, so the slow install step is cached until dependencies change.
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/api apps/api
# Prisma reads the URL from its config; generating the client does not connect to it.
ENV DATABASE_URL=mysql://build:build@localhost:3306/build
RUN npm run build --workspace=@vetnexa/api

# ── migrate ──
FROM build AS migrate
WORKDIR /app/apps/api
ENV DATABASE_URL=
CMD ["npx", "prisma", "migrate", "deploy"]

# ── runtime ──
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=4100 \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace=@vetnexa/api --no-audit --no-fund \
    && npm cache clean --force \
    && mkdir -p /data/uploads \
    && chown -R node:node /data
COPY --from=build /app/apps/api/dist apps/api/dist

USER node
WORKDIR /app/apps/api
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4100/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.js"]
