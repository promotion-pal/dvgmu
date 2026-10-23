package app

import (
	"log/slog"

	"github.com/pressly/goose/v3"

	"dvgmu/analytics"
	grpcapp "dvgmu/analytics/internal/app/grpc"
	"dvgmu/analytics/internal/config"
	"dvgmu/analytics/internal/grpc"
	"dvgmu/analytics/internal/service"
	"dvgmu/analytics/internal/storage"
)

type App struct {
	GRPCServer *grpcapp.App
}

func New(
	log *slog.Logger,
	cfg *config.Config,
) *App {
	db, err := storage.New(cfg.Database, log)
	if err != nil {
		log.Error("failed to connect database", "error", err.Error())
		panic(err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Error("failed to obtain sql.DB from gorm pool", "error", err.Error())
		panic(err)
	}

	if err := goose.SetDialect("postgres"); err != nil {
		log.Error("failed to set goose dialect", "error", err.Error())
		panic(err)
	}
	goose.SetBaseFS(analytics.MigrationsFS)

	log.Info("running database migrations")
	if err := goose.Up(sqlDB, "db/migrations/analytic"); err != nil {
		log.Error("migration execution failed", "error", err.Error())
		panic(err)
	}
	log.Info("database migrations applied")

	ipStorage := storage.IPStorageNew(db, log)
	ipService := service.NewIPService(ipStorage, cfg.Reevaluation)

	analyticStorage := storage.AnalyticStorageNew(db, log)
	analyticService := service.NewAnalyticService(analyticStorage, ipService)
	analyticHandler := grpc.AnalyticNewController(analyticService)

	grpcApp := grpcapp.New(
		log,
		analyticHandler,
		cfg.GRPC.Port,
	)

	return &App{
		GRPCServer: grpcApp,
	}
}
