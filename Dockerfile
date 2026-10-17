# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Stage 1: install dependencies (cached on the lockfile + manifests only)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/config/package.json packages/config/package.json

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ---------------------------------------------------------------------------
# Stage 2: build the static export (apps/web/out)
# ---------------------------------------------------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# The container serves the site from the domain root. Override for sub-path hosting.
ARG BASE_PATH=""
ARG NEXT_PUBLIC_SITE_URL="http://localhost:8080"
ENV BASE_PATH=$BASE_PATH \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

COPY tsconfig.json prettier.config.mjs turbo.json ./
COPY packages packages
COPY apps apps
RUN pnpm --filter @aspirant/web build

# ---------------------------------------------------------------------------
# Stage 3: runtime. Non-root nginx serving plain static files on :8080
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

ARG VERSION=dev
ARG REVISION=unknown
ARG SOURCE_URL=""
LABEL org.opencontainers.image.title="aspirant-web" \
      org.opencontainers.image.description="Static Next.js site served by nginx (unprivileged)" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$REVISION \
      org.opencontainers.image.source=$SOURCE_URL \
      org.opencontainers.image.licenses="MIT"

# Pick up fixed Alpine packages that are newer than the base image (scanner gate).
USER root
RUN apk upgrade --no-cache
USER 101

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build --chown=101:101 /repo/apps/web/out /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1

# nginx-unprivileged already runs as uid 101 (nginx); stated explicitly for scanners.
USER 101
CMD ["nginx", "-g", "daemon off;"]
