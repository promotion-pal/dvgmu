FROM golang:1.26-alpine AS build

WORKDIR /src
COPY packages/go packages/go
COPY packages/authsession packages/authsession
COPY services/tasks/go.mod services/tasks/go.sum services/tasks/
WORKDIR /src/services/tasks
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/tasks ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/tasks ./cmd

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/tasks ./tasks
COPY services/tasks/config ./config
EXPOSE 4000
CMD ["./tasks", "--config=config/prod.yaml"]
