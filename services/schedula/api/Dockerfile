FROM golang:1.26-alpine AS build

WORKDIR /src
COPY packages/go packages/go
COPY services/schedula/api/go.mod services/schedula/api/go.sum services/schedula/api/
WORKDIR /src/services/schedula/api
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/schedula/api ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /out/schedula ./cmd

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/schedula ./schedula
COPY services/schedula/api/config ./config
USER 65534:65534

EXPOSE 4000
CMD ["./schedula", "--config=config/prod.yaml"]
