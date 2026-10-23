FROM golang:1.26-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /out/dvgmu ./cmd/dvgmu

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/dvgmu ./dvgmu
COPY config ./config

EXPOSE 4000

CMD ["./dvgmu", "--config=config/prod.yaml"]
