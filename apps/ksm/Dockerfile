FROM node:22-alpine

ARG NEXT_PUBLIC_API

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
RUN ls -la node_modules/.bin/next

COPY . .

ENV NEXT_PUBLIC_API=${NEXT_PUBLIC_API}

RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "start"]
