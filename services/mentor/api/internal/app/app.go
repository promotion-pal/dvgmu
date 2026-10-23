package app

import (
	"log/slog"

	"github.com/pressly/goose/v3"

	"dvgmu/api"
	grpcapp "dvgmu/api/internal/app/grpc"
	"dvgmu/api/internal/config"
	"dvgmu/api/internal/grpc"
	"dvgmu/api/internal/service"
	"dvgmu/api/internal/storage"
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
	goose.SetBaseFS(api.MigrationsFS)

	log.Info("running database migrations")
	if err := goose.Up(sqlDB, "db/migrations/mentor"); err != nil {
		log.Error("migration execution failed", "error", err.Error())
		panic(err)
	}
	log.Info("database migrations applied")

	mentorStorage := storage.MentorStorageNew(db, log)
	mentorService := service.NewMentorService(mentorStorage)
	mentorHandler := grpc.MentorNewController(mentorService)

	grpcApp := grpcapp.New(
		log,
		mentorHandler,
		cfg.GRPC.Port,
		cfg.GRPC.CORSAllowedOrigins,
	)

	return &App{
		GRPCServer: grpcApp,
	}
}
