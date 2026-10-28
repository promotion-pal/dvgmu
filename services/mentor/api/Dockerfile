FROM golang:1.26-alpine AS build

# Контекст сборки — корень монорепо (см. services/mentor/api/Dockerfile.dockerignore):
# сгенерированный Go всех схем лежит в packages/go, go.mod подключает его через
# replace fesmu/contract => ../../../packages/go — поэтому раскладка папок в образе
# повторяет репозиторий.
WORKDIR /src
COPY packages/go packages/go
COPY services/mentor/api/go.mod services/mentor/api/go.sum services/mentor/api/
WORKDIR /src/services/mentor/api
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/mentor/api ./

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/dvgmu ./cmd/dvgmu

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/dvgmu ./dvgmu
COPY services/mentor/api/config ./config

EXPOSE 4000

CMD ["./dvgmu", "--config=config/prod.yaml"]
