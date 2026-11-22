package app

import (
	"log/slog"

	mdm "dvgmu/mdm"
	grpcapp "dvgmu/mdm/internal/app/grpc"
	"dvgmu/mdm/internal/config"
	"dvgmu/mdm/internal/grpc"
	"dvgmu/mdm/internal/service"
	"dvgmu/mdm/internal/storage"
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
	goose.SetBaseFS(mdm.MigrationsFS)
	goose.SetTableName("goose_db_version_mdm")
	log.Info("running MDM database migrations")
	if err := goose.Up(sqlDB, "db/migrations/user"); err != nil {
		panic(err)
	}
	log.Info("MDM database migrations applied")

	userStorage := storage.NewUserStorage(db)
	userService := service.NewUserService(userStorage)
	userController := grpc.NewUserController(userService, cfg.InternalServiceToken, cfg.GatewaySharedSecret)
	return &App{GRPCServer: grpcapp.New(log, userController, cfg.GRPC.Port, cfg.GRPC.AllowedOrigins)}
}
