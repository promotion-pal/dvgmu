FROM golang:1.26-alpine AS build

# Контекст сборки — корень монорепо (см. services/dormitory/api/Dockerfile.dockerignore):
# сгенерированный Go всех схем лежит в packages/go, go.mod подключает его через
# replace fesmu/contract => ../../../packages/go — поэтому раскладка папок в образе
# повторяет репозиторий.
WORKDIR /src
COPY packages/go packages/go
COPY services/dormitory/api/go.mod services/dormitory/api/go.sum services/dormitory/api/
WORKDIR /src/services/dormitory/api
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/dormitory/api ./

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/dormitory ./cmd

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/dormitory ./dormitory
COPY services/dormitory/api/config ./config

EXPOSE 4000

CMD ["./dormitory", "--config=config/prod.yaml"]
