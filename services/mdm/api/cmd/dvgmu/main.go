package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"dvgmu/api/internal/app"
	"dvgmu/api/internal/config"

	"github.com/joho/godotenv"
)

var Version = "dev"

func main() {
	// Загружается только api/.env — родительский .env (docker-compose)
	// намеренно не подхватывается, чтобы не перетирать порт БД и другие
	// значения из config/dev.yaml переменными окружения, актуальными
	// только для контейнерного запуска.
	_ = godotenv.Load(".env")

	cfg := config.MustLoad()

	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))
	log.Info("starting dvgmu-api", "version", Version)

	application := app.New(log, cfg)

	go func() {
		application.GRPCServer.MustRun()
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)

	<-stop

	application.GRPCServer.Stop()
	log.Info("Server gracefully stopped")
}
