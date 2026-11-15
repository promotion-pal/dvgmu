FROM golang:1.26-alpine AS build

WORKDIR /src
COPY packages/go packages/go
COPY services/tickets/go.mod services/tickets/go.sum services/tickets/
WORKDIR /src/services/tickets
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/tickets ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/tickets ./cmd

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/tickets ./tickets
COPY services/tickets/config ./config
EXPOSE 4000
CMD ["./tickets", "--config=config/prod.yaml"]
