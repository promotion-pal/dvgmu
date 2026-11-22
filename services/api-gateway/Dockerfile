FROM golang:1.26-alpine AS build

WORKDIR /src
COPY packages/go packages/go
COPY services/api-gateway/go.mod services/api-gateway/
WORKDIR /src/services/api-gateway
RUN go mod download
COPY services/api-gateway .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api-gateway ./cmd

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/api-gateway ./api-gateway
EXPOSE 4052
CMD ["./api-gateway"]
