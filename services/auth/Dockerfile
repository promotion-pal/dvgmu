FROM golang:1.26-alpine AS build

WORKDIR /src
COPY packages/go packages/go
COPY services/auth/go.mod services/auth/
WORKDIR /src/services/auth
RUN go mod download
COPY services/auth .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/auth ./cmd && \
    CGO_ENABLED=0 GOOS=linux go build -o /out/auth-set-login ./cmd/set-login

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/auth ./auth
COPY --from=build /out/auth-set-login ./auth-set-login
EXPOSE 4053
CMD ["./auth"]
