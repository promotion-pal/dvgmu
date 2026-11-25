FROM node:22-alpine AS build

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/lk/package.json apps/lk/package.json
COPY packages/ts/package.json packages/ts/package.json

RUN pnpm install --frozen-lockfile --filter lk...

COPY apps/lk/ apps/lk/
COPY packages/ts/ packages/ts/

ARG VITE_GATEWAY_URL=https://api.core.fesmu.ru
ARG VERSION=dev
ENV VITE_GATEWAY_URL=${VITE_GATEWAY_URL}

RUN pnpm --filter lk build

FROM nginx:1.29-alpine

ARG VERSION=dev
LABEL org.opencontainers.image.version=${VERSION}

COPY apps/lk/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/lk/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
