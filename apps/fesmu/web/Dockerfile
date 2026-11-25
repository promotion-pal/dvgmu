FROM node:22-alpine

ARG VERSION=dev
ENV VITE_APP_VERSION=${VERSION}

ARG API_URL=https://api.core.fesmu.ru
ENV VITE_API_URL=${API_URL}

ARG AUTH_URL=https://auth.fesmu.ru
ENV VITE_AUTH_URL=${AUTH_URL}

ENV NODE_OPTIONS=--no-network-family-autoselection

WORKDIR /workspace

RUN npm install -g pnpm

# Контекст сборки — корень монорепо (общий pnpm workspace и packages/);
# что именно попадает в контекст, задаёт Dockerfile.dockerignore рядом.
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/fesmu/web/package.json apps/fesmu/web/package.json
# @fesmu/contract (packages/ts) — сгенерированный TS всех схем, небольшой:
# берём целиком до install, чтобы pnpm связал его в workspace.
COPY packages/ts packages/ts

RUN pnpm install --frozen-lockfile

COPY apps/fesmu/web apps/fesmu/web

WORKDIR /workspace/apps/fesmu/web
RUN pnpm run build

EXPOSE 3000

CMD ["node", "node_modules/vite/bin/vite.js", "preview", "--host", "0.0.0.0", "--port", "3000"]
