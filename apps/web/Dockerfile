# syntax=docker/dockerfile:1
# VetNexa web app: built with Vite, served by Nginx, which also forwards /api and /uploads
# to the API container so the browser sees a single origin (needed for the session cookie).
#   docker build -f apps/web/Dockerfile -t vetnexa-web .

# ── build ──
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build --workspace=@vetnexa/web

# ── runtime ──
FROM nginx:1.28-alpine AS runtime
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
