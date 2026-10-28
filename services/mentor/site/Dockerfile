FROM node:22-alpine

RUN npm install -g pnpm

# Контекст сборки — корень монорепо (общий pnpm workspace и packages/ts —
# @fesmu/contract); что попадает в контекст, задаёт Dockerfile.dockerignore рядом.

ARG NEXT_PUBLIC_API=/api

ARG API_INTERNAL_URL=http://dvgmu_apps_mentor_api:4000

WORKDIR /workspace
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY services/mentor/site/package.json services/mentor/site/package.json
COPY packages/ts packages/ts
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "mentor..."

COPY services/mentor/site services/mentor/site

ENV NEXT_PUBLIC_API=${NEXT_PUBLIC_API}

ENV API_INTERNAL_URL=${API_INTERNAL_URL}
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /workspace/services/mentor/site
# next напрямую, не через pnpm: pnpm 10+ при каждом запуске сверяет свою
# версию из package.json#packageManager с npm-реестром, а он с сервера
# периодически недоступен ("Refusing to run pnpm@11.10.0").
RUN node node_modules/next/dist/bin/next build

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
