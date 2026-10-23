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

COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/app/package.json apps/app/package.json
COPY packages/contract/package.json packages/contract/package.json

RUN pnpm install --frozen-lockfile

COPY apps/app apps/app
COPY packages packages

WORKDIR /workspace/apps/app
RUN pnpm run build

EXPOSE 3000

CMD ["node", "node_modules/vite/bin/vite.js", "preview", "--host", "0.0.0.0", "--port", "3000"]
