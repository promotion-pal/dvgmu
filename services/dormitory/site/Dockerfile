FROM node:22-alpine

RUN npm install -g pnpm

# Контекст сборки — services/dormitory (нужен и site/, и сосед packages/,
# который подключается по tsconfig-алиасу @proto/* → ../packages/proto/*).

ARG NEXT_PUBLIC_API=/api
ARG NEXT_PUBLIC_ADMIN_PASSWORD
ARG API_INTERNAL_URL=http://dvgmu_dormitory_api:4000

# --- сгенерированный контракт (@bufbuild/protobuf для _pb.ts) ---
WORKDIR /workspace/packages
COPY packages/package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install
COPY packages/proto ./proto

# --- сам сайт ---
WORKDIR /workspace/site
COPY site/package.json site/pnpm-lock.yaml site/pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY site .

ENV NEXT_PUBLIC_API=${NEXT_PUBLIC_API}
ENV NEXT_PUBLIC_ADMIN_PASSWORD=${NEXT_PUBLIC_ADMIN_PASSWORD}
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV NEXT_TELEMETRY_DISABLED=1

# next напрямую, не через pnpm: pnpm 10+ при каждом запуске сверяет свою
# версию из package.json#packageManager с npm-реестром, а он с сервера
# периодически недоступен ("Refusing to run pnpm@11.10.0").
RUN node node_modules/next/dist/bin/next build

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
