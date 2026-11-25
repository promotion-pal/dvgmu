package app

import (
	"log/slog"

	"github.com/pressly/goose/v3"

	filemigrations "dvgmu/file"
	grpcapp "dvgmu/file/internal/app/grpc"
	"dvgmu/file/internal/config"
	filegrpc "dvgmu/file/internal/grpc"
	"dvgmu/file/internal/service"
	"dvgmu/file/internal/storage"
	"dvgmu/file/internal/utils"
	"dvgmu/file/internal/utils/excel"
	"dvgmu/file/internal/utils/word"
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
	goose.SetBaseFS(filemigrations.MigrationsFS)

	log.Info("running database migrations")
	if err := goose.Up(sqlDB, "db/migrations/file"); err != nil {
		log.Error("migration execution failed", "error", err.Error())
		panic(err)
	}
	log.Info("database migrations applied")

	fileStorage := storage.FileStorageNew(db, log)
	fileFS := utils.NewStorage(cfg.Storage.BasePath, log)
	excelParser := excel.NewParser(log)
	wordGen := word.NewGenerator(cfg.Word.TemplatesDir, log)
	fileService := service.NewFileService(log, fileStorage, fileStorage, fileFS, excelParser, wordGen)

	filesHandler := filegrpc.FilesNewController(fileService, fileFS, log)

	grpcApp := grpcapp.New(
		log,
		filesHandler,
		cfg.GRPC.Port,
		cfg.GRPC.CORSAllowedOrigins,
	)

	return &App{
		GRPCServer: grpcApp,
	}
}
