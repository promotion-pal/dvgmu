package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"dvgmu/api-gateway/internal/gateway"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	application, err := gateway.New(gateway.Config{
		Port:           env("GATEWAY_PORT", "4052"),
		AuthURL:        env("GATEWAY_AUTH_URL", "http://localhost:4053"),
		MDMURL:         env("GATEWAY_MDM_URL", "http://localhost:4051"),
		TicketsURL:     env("GATEWAY_TICKETS_URL", "http://localhost:4050"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		SharedSecret:   os.Getenv("GATEWAY_SHARED_SECRET"),
		JWTIssuer:      env("JWT_ISSUER", "dvgmu-auth"),
		AllowedOrigins: split(env("GATEWAY_ALLOWED_ORIGINS", "http://localhost:5173")),
	}, log)
	if err != nil {
		log.Error("gateway configuration is invalid", slog.String("error", err.Error()))
		os.Exit(1)
	}
	server := &http.Server{Addr: ":" + application.Port, Handler: application.Handler(), ReadHeaderTimeout: 5 * time.Second}
	log.Info("API gateway started", slog.String("port", application.Port))
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Error("API gateway stopped", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

func split(value string) []string {
	parts := strings.Split(value, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		if origin := strings.TrimSpace(part); origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
