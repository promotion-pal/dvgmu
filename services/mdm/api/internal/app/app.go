package app

import (
	"log/slog"

	"github.com/pressly/goose/v3"

	"dvgmu/api"
	grpcapp "dvgmu/api/internal/app/grpc"
	"dvgmu/api/internal/config"
	"dvgmu/api/internal/domain/models"
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
	if err := models.InitPassportEncryption(cfg.Encryption.PassportKey); err != nil {
		log.Error("failed to init passport encryption", "error", err.Error())
		panic(err)
	}

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
	goose.SetTableName("goose_db_version_user")
	if err := goose.Up(sqlDB, "migrations/user"); err != nil {
		log.Error("migration execution failed", "dir", "migrations/user", "error", err.Error())
		panic(err)
	}
	log.Info("database migrations applied")

	userStorage := storage.UserStorageNew(db)
	passportStorage := storage.PassportStorageNew(db)
	educationStorage := storage.EducationStorageNew(db)
	militaryStorage := storage.MilitaryStorageNew(db)
	studentStorage := storage.StudentStorageNew(db)
	employeeStorage := storage.EmployeeStorageNew(db)

	userService := service.NewUserService(log, userStorage, userStorage, passportStorage, educationStorage, militaryStorage, studentStorage, employeeStorage)
	activationService := service.NewActivationService(log, userStorage, storage.ActivationStorageNew(db))
	accessService := service.NewAccessGroupService(log, userStorage, storage.AccessGroupStorageNew(db))
	userHandler := grpc.UserNewController(userService, activationService, accessService)
	userLinkHandler := grpc.UserLinkNewController(userService, activationService, cfg.InternalToken)
	if cfg.InternalToken == "" {
		log.Warn("MDM_INTERNAL_TOKEN is empty — UserLinkService rejects every request")
	}

	grpcApp := grpcapp.New(
		log,
		userHandler,
		userLinkHandler,
		cfg.AllowedOrigins,
		cfg.GRPC.Port,
	)

	return &App{
		GRPCServer: grpcApp,
	}
}
