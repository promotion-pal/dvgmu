package app

import (
	"log/slog"
	"net/http"

	"dvgmu/tickets"
	"dvgmu/tickets/internal/access"
	grpcapp "dvgmu/tickets/internal/app/grpc"
	"dvgmu/tickets/internal/config"
	ticketgrpc "dvgmu/tickets/internal/grpc"
	"dvgmu/tickets/internal/service"
	"dvgmu/tickets/internal/storage"
	"fesmu/contract/mdm/service/serviceconnect"
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
	goose.SetBaseFS(tickets.MigrationsFS)
	log.Info("running task database migrations")
	if err := goose.Up(sqlDB, "db/migrations/task"); err != nil {
		panic(err)
	}
	log.Info("task database migrations applied")

	taskStorage := storage.NewTaskStorage(db)
	mdmClient := serviceconnect.NewUserServiceClient(&http.Client{Timeout: cfg.GRPC.Timeout}, cfg.MDM.URL)
	permissionChecker := access.NewMDM(mdmClient)
	taskService := service.NewTaskService(taskStorage, permissionChecker)
	controller := ticketgrpc.NewTaskController(taskService)
	return &App{GRPCServer: grpcapp.New(log, controller, cfg.GRPC.Port)}
}
