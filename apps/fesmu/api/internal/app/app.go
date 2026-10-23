package app

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/pressly/goose/v3"
	"gorm.io/gorm"

	"dvgmu/api"
	filesserviceconnect "dvgmu/api/contract/gen/go/packages/files/service/serviceconnect"
	mdmserviceconnect "dvgmu/api/contract/gen/go/packages/mdm/service/serviceconnect"
	serviceconnect "dvgmu/api/contract/gen/go/service/v1/servicev1connect"
	"dvgmu/api/contract/gen/go/service/v2/servicev2connect"
	"dvgmu/api/contract/gen/go/service/v3/servicev3connect"
	grpcapp "dvgmu/api/internal/app/grpc"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/config"
	"dvgmu/api/internal/grpc"
	"dvgmu/api/internal/mdm"
	"dvgmu/api/internal/modules/debtor"
	"dvgmu/api/internal/modules/library"
	"dvgmu/api/internal/modules/purchase"
	"dvgmu/api/internal/modules/purchasev3"
	"dvgmu/api/internal/modules/questionnaire"
	"dvgmu/api/internal/modules/survey"
	"dvgmu/api/internal/service"
	"dvgmu/api/internal/service/packages/certificate"
	"dvgmu/api/internal/service/packages/user"
	"dvgmu/api/internal/storage"
)

type App struct {
	GRPCServer *grpcapp.App
}

func New(
	log *slog.Logger,
	cfg *config.Config,
) *App {
	db, err := storage.New(cfg.Databases.InfrastructureDB, log)
	if err != nil {
		log.Error("failed to connect database", "error", err.Error())
		panic(err)
	}

	mustMigrate(log, db, "migrations/infrastructure")

	inventoryStorage := storage.InventoryStorageNew(db)
	infrastructureStorage := storage.InfrastructureStorageNew(db)

	inventoryService := service.NewInventoryService(log, inventoryStorage, inventoryStorage)
	inventoryHandler := grpc.InventoryNewController(inventoryService)

	infrastructureService := service.NewInfrastructureService(log, infrastructureStorage, infrastructureStorage)
	infrastructureHandler := grpc.InfrastructureNewController(infrastructureService)

	scheduleStorage := storage.ScheduleStorageNew(db)
	scheduleService := service.NewScheduleService(log, scheduleStorage, scheduleStorage)
	scheduleHandler := grpc.ScheduleNewController(scheduleService)

	// The collector page has no login — a teacher has no account in this
	// system — so its RPC is exempted from auth below, once an interceptor exists.
	scheduleCollectStorage := storage.ScheduleCollectStorageNew(db)
	scheduleCollectService := service.NewScheduleCollectService(log, scheduleCollectStorage)
	scheduleCollectHandler := grpc.ScheduleCollectNewController(scheduleCollectService)

	hallStorage := storage.HallStorageNew(db)
	hallService := service.NewHallService(log, hallStorage, hallStorage)
	hallHandler := grpc.HallNewController(hallService)

	computerClassStorage := storage.ComputerClassStorageNew(db)
	computerClassService := service.NewComputerClassService(log, computerClassStorage, computerClassStorage)
	computerClassHandler := grpc.ComputerClassNewController(computerClassService)

	// The test builder keeps its tests in a database of its own. If that
	// database is unreachable, only the test builder is down (its calls answer
	// Unavailable): the rest of the API must not go down with it.
	var testService *service.TestService
	var testSessionService *service.TestSessionService
	// Question pictures go to the files service (tests/images); without it
	// the builder works, only pictures can't be added.
	var testImageFiles service.TestImageFiles
	if cfg.Packages.Files != "" {
		testImageFiles = service.NewTestImageFiles(filesserviceconnect.NewFilesServiceClient(http.DefaultClient, cfg.Packages.Files))
	}
	if testDB, err := connectAndMigrate(log, cfg.Databases.TestDB, "migrations/test"); err != nil {
		log.Error("test builder disabled: test database is unavailable", "dbname", cfg.Databases.TestDB.DBName, "error", err.Error())
	} else {
		testStorage := storage.TestStorageNew(testDB)
		testService = service.NewTestService(log, testStorage, testStorage, testStorage, testImageFiles)
		testSessionService = service.NewTestSessionService(log, storage.TestSessionStorageNew(testDB), testStorage)
	}
	testHandler := grpc.TestNewController(testService)
	testSessionHandler := grpc.TestSessionNewController(testSessionService)

	// Who is signed in comes from the auth access token (uuid, login, roles
	// set in MDM); name, email and MDM id — from MDM itself.
	var profiles grpc.Profiles
	if cfg.Packages.MDM != "" {
		profiles = mdm.NewClient(cfg.Packages.MDM)
	}
	userHandler := grpc.UserNewController(profiles, log)

	vaccinationStorage := storage.VaccinationStorageNew(db)
	vaccinationService := service.NewVaccinationService(log, vaccinationStorage, vaccinationStorage)
	vaccinationHandler := grpc.VaccinationNewController(vaccinationService)

	// Students' tuition balances, read live from 1C on every call. Stays behind
	// auth (not in Skip): it is personal financial data for the admin panel.
	debtorModule := debtor.New(log, cfg.OneC)

	// Purchases v2 live in purchase_db. If it is unreachable, only purchases
	// are down (their calls answer Unavailable).
	purchaseDB, err := connectAndMigrate(log, cfg.Databases.PurchaseDB, "migrations/purchase")
	if err != nil {
		log.Error("purchases disabled: purchase database is unavailable", "dbname", cfg.Databases.PurchaseDB.DBName, "error", err.Error())
		purchaseDB = nil
	}
	// Departments and names of purchase participants come from MDM's employees.
	var purchaseProfiles purchase.Profiles
	if cfg.Packages.MDM != "" {
		purchaseProfiles = purchaseEmployees{mdm.NewClient(cfg.Packages.MDM)}
	}
	purchaseModule := purchase.New(log, purchaseDB, purchaseProfiles)
	// Purchases v3 share purchase_db (tables purchase_v3_*) and MDM profiles.
	purchaseV3Module := purchasev3.New(log, purchaseDB, purchaseProfiles)

	var authInterceptor *auth.Interceptor
	if cfg.Auth.ServiceURL == "" {
		log.Warn("auth disabled: AUTH_SERVICE_URL is empty — Connect RPCs are NOT protected")
	} else {
		jwksURL := cfg.Auth.JWKSURL
		if jwksURL == "" {
			jwksURL = strings.TrimRight(cfg.Auth.ServiceURL, "/") + "/.well-known/jwks.json"
		}
		authInterceptor = auth.NewInterceptor(auth.NewJWKS(jwksURL), cfg.Auth.Issuer, cfg.Auth.Audience, cfg.Auth.CookieName)
		authInterceptor.Skip[serviceconnect.ScheduleCollectServiceScheduleCollectCreateProcedure] = true
		// The group timetable is public information shown on the students' page
		// (/schedule): reading it needs no login, editing it does.
		authInterceptor.Skip[serviceconnect.ScheduleServiceScheduleFetchProcedure] = true
		authInterceptor.Skip[serviceconnect.ScheduleServiceScheduleByIDProcedure] = true
		// Anyone may see how busy the lecture halls are and book one from the
		// public pages. The public fetch leaves out who booked; the full list
		// (HallBookingFetch) and cancelling stay behind auth.
		// Students check where and when their computer testing is without a login.
		authInterceptor.Skip[serviceconnect.ComputerClassServiceComputerClassSessionFetchProcedure] = true
		// Anyone signs up for vaccination and sees the list; managing days and
		// removing a sign-up need a login.
		authInterceptor.Skip[serviceconnect.VaccinationServiceVaccinationDayFetchProcedure] = true
		authInterceptor.Skip[serviceconnect.VaccinationServiceVaccinationSignupCreateProcedure] = true
		authInterceptor.Skip[serviceconnect.HallServiceHallFetchProcedure] = true
		authInterceptor.Skip[serviceconnect.HallServiceHallBookingPublicFetchProcedure] = true
		authInterceptor.Skip[serviceconnect.HallServiceHallBookingCreateProcedure] = true
		// Students take a test by its session link, without a login; these
		// calls never send which options are correct.
		authInterceptor.Skip[serviceconnect.TestSessionServiceTestTakeInfoProcedure] = true
		authInterceptor.Skip[serviceconnect.TestSessionServiceTestTakeStartProcedure] = true
		authInterceptor.Skip[serviceconnect.TestSessionServiceTestTakeStateProcedure] = true
		authInterceptor.Skip[serviceconnect.TestSessionServiceTestTakeAnswerProcedure] = true
		authInterceptor.Skip[serviceconnect.TestSessionServiceTestTakeFinishProcedure] = true
		// Анкета по QR — без входа (опрос без ответов, ответ с IP респондента).
		for _, p := range questionnaire.Procedures {
			authInterceptor.Skip[p] = true
		}

		// Кто в какой раздел (роли назначаются в MDM; ADMIN — везде; сервиса
		// нет в карте — только ADMIN). Та же раскладка — в меню фронта
		// (app-sidebar) и на маршрутах (App.tsx).
		// Роли — студенту и преподавателю; разделы сотрудников открывают
		// права на раздел из доступов (Sections), роль STAFF их не открывает.
		authInterceptor.Access = map[string][]string{
			serviceconnect.UserServiceName:        nil, // UserMe — любой, кто вошёл
			serviceconnect.CertificateServiceName: {auth.RoleStudent},
			// Библиотеку и опубликованные методички читает любой, кто вошёл;
			// изменения модуль проверяет сам (library.post, manuals.post).
			servicev2connect.LibraryServiceName: nil,
			// Закупки v3: права на действия ("purchase.<имя>"), отдел и
			// направление модуль проверяет сам — пускает любого, кто вошёл.
			servicev3connect.PurchaseServiceName: nil,
			// Импорт людей, задолженность — персональные данные: только
			// ADMIN (нет в карте).
		}
		authInterceptor.Sections = map[string][]auth.Section{
			serviceconnect.CertificateServiceName:     {auth.SectionCertificate},
			serviceconnect.InfrastructureServiceName:  {auth.SectionInfrastructure},
			serviceconnect.InventoryServiceName:       {auth.SectionInventory},
			serviceconnect.ScheduleServiceName:        {auth.SectionSchedule},
			serviceconnect.ScheduleCollectServiceName: {auth.SectionSchedule},
			serviceconnect.HallServiceName:            {auth.SectionHalls},
			serviceconnect.ComputerClassServiceName:   {auth.SectionComputerClasses},
			serviceconnect.VaccinationServiceName:     {auth.SectionVaccination},
			serviceconnect.TestServiceName:            {auth.SectionTests},
			serviceconnect.TestSessionServiceName:     {auth.SectionTests},
			// Опросы: номер QR — просмотр раздела, создание и правка — analytics.post.
			serviceconnect.SurveyServiceName: {auth.SectionAnalytics},
			// Закупки: просмотр любого раздела закупок открывает сервис; в какой
			// роли действовать, модуль проверяет по праву на её раздел.
			servicev2connect.PurchaseServiceName: auth.PurchaseSections,
		}
		log.Info("auth enabled", "jwks_url", jwksURL, "cookie_name", cfg.Auth.CookieName)
	}

	// mdm and tasks are proxied straight through to the external package
	// services (see internal/proxy) — no typed client/service layer for
	// simple CRUD passthrough.
	if cfg.Packages.MDM == "" {
		log.Warn("mdm proxy disabled: PACKAGE_MDM is empty")
	} else {
		log.Info("mdm proxy configured", "url", cfg.Packages.MDM)
	}
	if cfg.Packages.Tasks == "" {
		log.Warn("tasks proxy disabled: PACKAGE_TASKS is empty")
	} else {
		log.Info("tasks proxy configured", "url", cfg.Packages.Tasks)
	}
	if cfg.Packages.Analytics == "" {
		log.Warn("analytics proxy disabled: PACKAGE_ANALYTICS is empty")
	} else {
		log.Info("analytics proxy configured", "url", cfg.Packages.Analytics)
	}
	if cfg.Packages.Auth == "" {
		log.Warn("auth proxy disabled: PACKAGE_AUTH is empty")
	} else {
		log.Info("auth proxy configured", "url", cfg.Packages.Auth, "v2_token_set", cfg.Auth.InternalToken != "")
	}
	if cfg.Packages.Files == "" {
		log.Warn("files client disabled: PACKAGE_FILES is empty")
	} else {
		log.Info("files client configured", "url", cfg.Packages.Files)
	}

	// UserImportService and CertificateService genuinely combine two
	// services' responses each (files' parsed excel rows -> mdm's batch user
	// create; mdm's profile lookup -> files' document generation), so they
	// need typed clients instead of a passthrough.
	filesClient := filesserviceconnect.NewFilesServiceClient(http.DefaultClient, cfg.Packages.Files)
	mdmImportClient := mdmserviceconnect.NewUserServiceClient(http.DefaultClient, cfg.Packages.MDM)
	userImportService := user.NewImportService(log, filesClient, mdmImportClient)
	userImportHandler := grpc.UserImportNewController(userImportService)

	certificateService := certificate.NewService(log, mdmImportClient, filesClient, storage.CertificateStorageNew(db))
	certificateHandler := grpc.CertificateNewController(certificateService)

	// The library lives in library_db; its files go to the files service
	// (library/books, library/manuals). If the database is unreachable, only
	// the library is down.
	libraryDB, err := connectAndMigrate(log, cfg.Databases.LibraryDB, "migrations/library")
	if err != nil {
		log.Error("library disabled: library database is unavailable", "dbname", cfg.Databases.LibraryDB.DBName, "error", err.Error())
		libraryDB = nil
	}
	var libraryFiles library.Files
	if cfg.Packages.Files != "" {
		libraryFiles = filesClient
	}
	libraryModule := library.New(log, libraryDB, libraryFiles)

	grpcApp := grpcapp.New(
		log,
		inventoryHandler,
		infrastructureHandler,
		userImportHandler,
		certificateHandler,
		scheduleHandler,
		scheduleCollectHandler,
		hallHandler,
		computerClassHandler,
		testHandler,
		testSessionHandler,
		vaccinationHandler,
		userHandler,
		cfg.Packages.MDM,
		cfg.Packages.Tasks,
		cfg.Packages.Analytics,
		cfg.Packages.Auth,
		cfg.Auth.InternalToken,
		authInterceptor,
		cfg.GRPC.AllowedOrigins,
		cfg.GRPC.Port,
		debtorModule,
		purchaseModule,
		purchaseV3Module,
		libraryModule,
		questionnaire.New(log, cfg.Packages.Analytics),
		survey.New(log, cfg.Packages.Analytics),
	)

	return &App{
		GRPCServer: grpcApp,
	}
}

// mustMigrate applies the embedded goose migrations in dir to db, or panics.
func mustMigrate(log *slog.Logger, db *gorm.DB, dir string) {
	if err := migrate(log, db, dir); err != nil {
		log.Error("migration execution failed", "dir", dir, "error", err.Error())
		panic(err)
	}
}

// connectAndMigrate opens an optional database and brings its schema up to date.
func connectAndMigrate(log *slog.Logger, cfg config.DatabaseConfig, dir string) (*gorm.DB, error) {
	// An empty value would shift the DSN (e.g. "dbname= sslmode=disable"
	// reads as a database named "sslmode=disable"), so say what is missing.
	if cfg.Host == "" || cfg.DBName == "" || cfg.User == "" {
		return nil, fmt.Errorf("database is not configured: host=%q dbname=%q user=%q", cfg.Host, cfg.DBName, cfg.User)
	}
	db, err := storage.New(cfg, log)
	if err != nil {
		return nil, err
	}
	if err := migrate(log, db, dir); err != nil {
		return nil, err
	}
	return db, nil
}

// migrate applies the embedded goose migrations in dir to db.
func migrate(log *slog.Logger, db *gorm.DB, dir string) error {
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("obtain sql.DB from gorm pool: %w", err)
	}
	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set goose dialect: %w", err)
	}
	goose.SetBaseFS(api.MigrationsFS)

	log.Info("running database migrations", "dir", dir)
	if err := goose.Up(sqlDB, dir); err != nil {
		return err
	}
	log.Info("database migrations applied", "dir", dir)
	return nil
}

// purchaseEmployees adapts the MDM client to what the purchase module reads.
type purchaseEmployees struct{ c *mdm.Client }

func (p purchaseEmployees) Employees(ctx context.Context) ([]purchase.Employee, error) {
	list, err := p.c.Employees(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]purchase.Employee, len(list))
	for i, e := range list {
		out[i] = purchase.Employee{UUID: e.UUID, Name: e.Name, Department: e.Department, Position: e.Position}
	}
	return out, nil
}
