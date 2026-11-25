FROM golang:1.26-alpine AS build

# Контекст сборки — корень монорепо (см. services/auth/api/Dockerfile.dockerignore):
# сгенерированный Go всех схем лежит в packages/go, go.mod подключает его через
# replace fesmu/contract => ../../../packages/go — поэтому раскладка папок в образе
# повторяет репозиторий.
WORKDIR /src
COPY packages/go packages/go
COPY services/auth/api/go.mod services/auth/api/go.sum services/auth/api/
WORKDIR /src/services/auth/api
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/auth/api ./

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/auth ./cmd

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/auth ./auth
COPY services/auth/api/config ./config

EXPOSE 4000

CMD ["./auth", "--config=config/prod.yaml"]
