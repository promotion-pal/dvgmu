FROM golang:1.26-alpine AS build

WORKDIR /src
COPY packages/go packages/go
COPY services/mdm/go.mod services/mdm/go.sum services/mdm/
WORKDIR /src/services/mdm
RUN --mount=type=cache,target=/go/pkg/mod go mod download

COPY services/mdm ./
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build -o /out/mdm ./cmd && \
    CGO_ENABLED=0 GOOS=linux go build -o /out/mdm-set-admin ./cmd/set-admin

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=build /out/mdm ./mdm
COPY --from=build /out/mdm-set-admin ./mdm-set-admin
COPY services/mdm/config ./config
EXPOSE 4000
CMD ["./mdm", "--config=config/prod.yaml"]
