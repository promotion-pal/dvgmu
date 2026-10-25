FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod main.go ./
RUN CGO_ENABLED=0 go build -o /out/adfs-mock .

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/adfs-mock ./adfs-mock
COPY users.json ./users.json
EXPOSE 8080
CMD ["./adfs-mock"]
