FROM golang:1.26-alpine AS build

# Контекст сборки — корень монорепо (см. services/analytics/api/Dockerfile.dockerignore):
# сгенерированный Go всех схем лежит в packages/go, go.mod подключает его через
# replace fesmu/contract => ../../../packages/go — поэтому раскладка папок в образе
# повторяет репозиторий.
WORKDIR /src
COPY packages/go packages/go
COPY services/analytics/api/go.mod services/analytics/api/go.sum services/analytics/api/
WORKDIR /src/services/analytics/api
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/analytics/api ./

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/analytics ./cmd

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/analytics ./analytics
COPY services/analytics/api/config ./config

EXPOSE 4000

CMD ["./analytics", "--config=config/prod.yaml"]
