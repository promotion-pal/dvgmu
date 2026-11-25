FROM node:22-alpine

RUN npm install -g pnpm

# Контекст сборки — корень монорепо (общий pnpm workspace и packages/ts —
# @fesmu/contract); что попадает в контекст, задаёт Dockerfile.dockerignore рядом.

ARG NEXT_PUBLIC_API=/api
ARG NEXT_PUBLIC_ADMIN_PASSWORD
ARG API_INTERNAL_URL=http://dvgmu_dormitory_api:4000

WORKDIR /workspace
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY services/dormitory/site/package.json services/dormitory/site/package.json
COPY packages/ts packages/ts
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "dormitory..."

COPY services/dormitory/site services/dormitory/site

ENV NEXT_PUBLIC_API=${NEXT_PUBLIC_API}
ENV NEXT_PUBLIC_ADMIN_PASSWORD=${NEXT_PUBLIC_ADMIN_PASSWORD}
ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace/services/dormitory/site
# next напрямую, не через pnpm: pnpm 10+ при каждом запуске сверяет свою
# версию из package.json#packageManager с npm-реестром, а он с сервера
# периодически недоступен ("Refusing to run pnpm@11.10.0").
RUN node node_modules/next/dist/bin/next build

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
