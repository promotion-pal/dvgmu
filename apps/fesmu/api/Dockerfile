FROM golang:1.26-alpine AS build

# Контекст сборки — корень монорепо (см. apps/fesmu/api/Dockerfile.dockerignore):
# сгенерированный Go всех схем лежит в packages/go, go.mod подключает его через
# replace fesmu/contract => ../../../packages/go — поэтому раскладка папок в образе
# повторяет репозиторий.
WORKDIR /src
COPY packages/go packages/go
COPY packages/authsession packages/authsession
COPY apps/fesmu/api apps/fesmu/api
WORKDIR /src/apps/fesmu/api

# No separate `go mod download`: it fetches every module in go.mod (~680 MB,
# mostly google.golang.org/api pulled in by atlas tooling), while the binary
# needs ~90 MB of them. `go build` downloads only what ./cmd imports, and the
# cache mounts keep modules and compiled packages between builds without
# storing them in image layers.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/dvgmu ./cmd

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/dvgmu ./dvgmu
COPY apps/fesmu/api/config ./config

EXPOSE 4000

CMD ["./dvgmu", "--config=config/prod.yaml"]
