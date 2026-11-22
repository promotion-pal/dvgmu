package app

import (
	"log/slog"

	"dvgmu/tasks"
	grpcapp "dvgmu/tasks/internal/app/grpc"
	"dvgmu/tasks/internal/config"
	taskgrpc "dvgmu/tasks/internal/grpc"
	"dvgmu/tasks/internal/service"
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

	directions := taskgrpc.NewDirectionController(service.NewDirectionService(storage.NewDirectionStorage(db)), log)
	catalog := taskgrpc.NewCatalogController(service.NewCatalogService(storage.NewServiceStorage(db)), log)
	statuses := taskgrpc.NewStatusController(service.NewStatusService(storage.NewStatusStorage(db)), log)
	priorities := taskgrpc.NewPriorityController(service.NewPriorityService(storage.NewPriorityStorage(db)), log)
	forms := taskgrpc.NewServiceFormController(service.NewServiceFormService(storage.NewServiceFormStorage(db)), log)
	return &App{GRPCServer: grpcapp.New(log, sqlDB.PingContext, cfg, directions, catalog, statuses, priorities, forms)}
}
