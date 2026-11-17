package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"dvgmu/mdm/internal/app"
	"dvgmu/mdm/internal/config"
	"github.com/joho/godotenv"
)

var Version = "dev"

func main() {
	_ = godotenv.Load(".env")
	cfg := config.MustLoad()
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
	log.Info("starting MDM API", "version", Version)
	application := app.New(log, cfg)
	go application.GRPCServer.MustRun()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	<-stop
	application.GRPCServer.Stop()
	log.Info("server stopped")
}
