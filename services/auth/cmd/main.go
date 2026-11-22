package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"dvgmu/auth/internal/app"
	"dvgmu/auth/internal/config"
)

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	application, err := app.New(config.Load(), log)
	if err != nil {
		log.Error("could not initialize Auth", slog.String("error", err.Error()))
		os.Exit(1)
	}
	go func() {
		if err := application.Run(); err != nil {
			log.Error("Auth stopped", slog.String("error", err.Error()))
			os.Exit(1)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)
	<-stop
	application.Stop()
}
