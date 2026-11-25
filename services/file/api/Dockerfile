FROM golang:1.26-alpine AS build

# Контекст сборки — корень монорепо (см. services/file/api/Dockerfile.dockerignore):
# сгенерированный Go всех схем лежит в packages/go, go.mod подключает его через
# replace fesmu/contract => ../../../packages/go — поэтому раскладка папок в образе
# повторяет репозиторий.
WORKDIR /src
COPY packages/go packages/go
COPY services/file/api/go.mod services/file/api/go.sum services/file/api/
WORKDIR /src/services/file/api
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/file/api ./

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/file ./cmd

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/file ./file
COPY services/file/api/config ./config

EXPOSE 4000

CMD ["./file", "--config=config/prod.yaml"]
