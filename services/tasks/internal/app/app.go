package app

import (
	"log/slog"

	"dvgmu/tasks"
	grpcapp "dvgmu/tasks/internal/app/grpc"
	"dvgmu/tasks/internal/config"
	"dvgmu/tasks/internal/storage"
	"github.com/pressly/goose/v3"
)

type App struct {
	GRPCServer *grpcapp.App
}

func New(log *slog.Logger, cfg *config.Config) *App {
	db, err := storage.New(cfg.Database, log)
	if err != nil {
		panic(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		panic(err)
	}
	if err := goose.SetDialect("postgres"); err != nil {
		panic(err)
	}
	goose.SetBaseFS(tasks.MigrationsFS)
	log.Info("running task database migrations")
	if err := goose.Up(sqlDB, "db/migrations/task"); err != nil {
		panic(err)
	}
	log.Info("task database migrations applied")

	return &App{GRPCServer: grpcapp.New(log, sqlDB.PingContext, cfg.GRPC)}
}
