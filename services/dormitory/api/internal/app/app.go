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
	if err := goose.Up(sqlDB, "db/migrations/dormitory"); err != nil {
		log.Error("migration execution failed", "error", err.Error())
		panic(err)
	}
	log.Info("database migrations applied")

	dormitoryStorage := storage.DormitoryRegistrationStorageNew(db, log)
	dormitoryService := service.NewDormitoryRegistrationService(dormitoryStorage)

	userStorage := storage.UserStorageNew(db, log)
	userService := service.NewUserService(userStorage)
	userHandler := grpc.UserNewController(userService)

	dormitoryHandler := grpc.DormitoryNewController(dormitoryService, userService, cfg.AdminPassword)

	reportHandler := grpc.ReportNewController(dormitoryService, userService)

	grpcApp := grpcapp.New(
		log,
		dormitoryHandler,
		userHandler,
		reportHandler,
		cfg.GRPC.Port,
		cfg.GRPC.CORSAllowedOrigins,
	)

	return &App{
		GRPCServer: grpcApp,
	}
}
