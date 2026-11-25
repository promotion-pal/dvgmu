package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"dvgmu/schedula/internal/app"
	"dvgmu/schedula/internal/config"
)

func main() {
	path := flag.String("config", "config/local.yaml", "path to config file")
	flag.Parse()
	log := slog.New(slog.NewJSONHandler(os.Stderr, nil))
	cfg, err := config.Load(*path)
	if err != nil {
		log.Error("load schedula config", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := app.Run(ctx, cfg, log); err != nil {
		log.Error("run schedula", "error", err)
		os.Exit(1)
	}
}
