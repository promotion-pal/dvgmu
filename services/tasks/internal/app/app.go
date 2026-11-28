package app

import (
	"log/slog"
	"net/http"
	"time"
	_ "time/tzdata"

	"dvgmu/tasks"
	"dvgmu/tasks/internal/access"
	grpcapp "dvgmu/tasks/internal/app/grpc"
	"dvgmu/tasks/internal/config"
	taskgrpc "dvgmu/tasks/internal/grpc"
	"dvgmu/tasks/internal/service"
	"dvgmu/tasks/internal/storage"
	"fesmu/authsession"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	"fesmu/contract/tasks/service/serviceconnect"
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
	settings := taskgrpc.NewServiceSettingsController(service.NewServiceSettingsService(storage.NewServiceSettingsStorage(db)), log)
	routes := taskgrpc.NewServiceRoutesController(service.NewServiceRoutesService(storage.NewServiceRoutesStorage(db)), log)
	queueStore := storage.NewQueueStorage(db)
	numberLocation, err := time.LoadLocation("Asia/Vladivostok")
	if err != nil {
		panic(err)
	}
	var taskHandler serviceconnect.TaskServiceHandler
	var queueAccessHandler serviceconnect.QueueAccessServiceHandler
	var applicant *access.ApplicantResolver
	if cfg.Auth.JWKSURL != "" || cfg.Auth.MDMURL != "" {
		if cfg.Auth.JWKSURL == "" || cfg.Auth.MDMURL == "" {
			panic("tasks authenticated APIs require both TASKS_AUTH_JWKS_URL and TASKS_MDM_URL")
		}
		keys := authsession.NewJWKS(cfg.Auth.JWKSURL)
		verifier := authsession.NewVerifier(keys, cfg.Auth.Issuer, cfg.Auth.Audience, cfg.Auth.CookieName)
		mdm := mdmconnect.NewUserServiceClient(&http.Client{Timeout: 5 * time.Second}, cfg.Auth.MDMURL)
		applicant = access.NewApplicantResolver(verifier, mdm, log)
		taskHandler = taskgrpc.NewTaskController(service.NewTaskService(storage.NewTaskStorage(db), numberLocation), applicant, log)
		queueAccessHandler = taskgrpc.NewQueueViewAccessController(service.NewQueueViewAccessService(queueStore, applicant.RequireActiveUser), applicant.RequireAdmin, log)
	}
	queues := taskgrpc.NewQueueController(service.NewQueueService(queueStore), applicant, log)
	return &App{GRPCServer: grpcapp.New(log, sqlDB.PingContext, cfg, directions, catalog, statuses, priorities, forms, settings, routes, queues, taskHandler, queueAccessHandler)}
}
