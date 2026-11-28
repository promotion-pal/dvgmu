package grpc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"connectrpc.com/connect"
	"connectrpc.com/grpcreflect"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/grpc"
	"dvgmu/api/internal/proxy"
	analyticsserviceconnect "fesmu/contract/analytics/service/serviceconnect"
	"fesmu/contract/auth/v2/authv2connect"
	examserviceconnect "fesmu/contract/fesmu/exam/service/v1/servicev1connect"
	serviceconnect "fesmu/contract/fesmu/service/v1/servicev1connect"
	mdmserviceconnect "fesmu/contract/mdm/service/serviceconnect"
	requestserviceconnect "fesmu/contract/tasks/service/serviceconnect"
	tasksserviceconnect "fesmu/contract/tickets/service/serviceconnect"
)

// Module is a self-contained feature (see internal/modules) that mounts its
// own handlers, so the host needs no knowledge of what is inside.
type Module interface {
	// Mount registers the module's handlers and returns their service names.
	Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string
}

type App struct {
	log        *slog.Logger
	httpServer *http.Server
	port       int
}

func New(
	log *slog.Logger,
	inventoryHandler *grpc.InventoryHandler,
	infrastructureHandler *grpc.InfrastructureHandler,
	userImportHandler *grpc.UserImportHandler,
	certificateHandler *grpc.CertificateHandler,
	scheduleHandler *grpc.ScheduleHandler,
	scheduleCollectHandler *grpc.ScheduleCollectHandler,
	hallHandler *grpc.HallHandler,
	computerClassHandler *grpc.ComputerClassHandler,
	testHandler *grpc.TestHandler,
	testSessionHandler *grpc.TestSessionHandler,
	examTestHandler *grpc.TestHandler,
	examTestSessionHandler *grpc.TestSessionHandler,
	vaccinationHandler *grpc.VaccinationHandler,
	userHandler *grpc.UserHandler,
	mdmURL string,
	tasksURL string,
	requestsURL string,
	analyticsURL string,
	authURL string,
	authToken string,
	authInterceptor *auth.Interceptor,
	allowedOrigins []string,
	port int,
	modules ...Module,
) *App {
	mux := http.NewServeMux()

	var opts []connect.HandlerOption
	if authInterceptor != nil {
		opts = append(opts, connect.WithInterceptors(authInterceptor))
	}

	corsHandler := cors.New(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{
			"GET", "POST", "OPTIONS", "PUT", "DELETE",
		},
		AllowedHeaders: []string{
			"Connect-Protocol-Version",
			"Content-Type",
			"Authorization",
			"Cookie",
			"X-Grpc-Web",
			"X-User-Agent",
		},
		ExposedHeaders: []string{
			"Connect-Content-Encoding",
			"Connect-Accept-Encoding",
			"Grpc-Status",
			"Grpc-Message",
		},
		AllowCredentials: true,
	})

	inventoryPath, inventoryConnectHandler := serviceconnect.NewInventoryServiceHandler(inventoryHandler, opts...)
	mux.Handle(inventoryPath, inventoryConnectHandler)

	infrastructurePath, infrastructureConnectHandler := serviceconnect.NewInfrastructureServiceHandler(infrastructureHandler, opts...)
	mux.Handle(infrastructurePath, infrastructureConnectHandler)

	userImportPath, userImportConnectHandler := serviceconnect.NewUserImportServiceHandler(userImportHandler, opts...)
	mux.Handle(userImportPath, userImportConnectHandler)

	certificatePath, certificateConnectHandler := serviceconnect.NewCertificateServiceHandler(certificateHandler, opts...)
	mux.Handle(certificatePath, certificateConnectHandler)

	schedulePath, scheduleConnectHandler := serviceconnect.NewScheduleServiceHandler(scheduleHandler, opts...)
	mux.Handle(schedulePath, scheduleConnectHandler)

	scheduleCollectPath, scheduleCollectConnectHandler := serviceconnect.NewScheduleCollectServiceHandler(scheduleCollectHandler, opts...)
	mux.Handle(scheduleCollectPath, scheduleCollectConnectHandler)

	hallPath, hallConnectHandler := serviceconnect.NewHallServiceHandler(hallHandler, opts...)
	mux.Handle(hallPath, hallConnectHandler)

	computerClassPath, computerClassConnectHandler := serviceconnect.NewComputerClassServiceHandler(computerClassHandler, opts...)
	mux.Handle(computerClassPath, computerClassConnectHandler)

	vaccinationPath, vaccinationConnectHandler := serviceconnect.NewVaccinationServiceHandler(vaccinationHandler, opts...)
	mux.Handle(vaccinationPath, vaccinationConnectHandler)

	testPath, testConnectHandler := serviceconnect.NewTestServiceHandler(testHandler, opts...)
	mux.Handle(testPath, testConnectHandler)
	// Question pictures, for <img>: open, as students see them while taking a test.
	mux.Handle("GET /test-images/{hash}", testHandler.ImageHTTP())

	testSessionPath, testSessionConnectHandler := serviceconnect.NewTestSessionServiceHandler(testSessionHandler, opts...)
	mux.Handle(testSessionPath, testSessionConnectHandler)

	examTestPath, examTestConnectHandler := examserviceconnect.NewExamTestServiceHandler(examTestHandler, opts...)
	mux.Handle(examTestPath, examTestConnectHandler)
	mux.Handle("GET /exam-test-images/{hash}", examTestHandler.ImageHTTP())
	examTestSessionPath, examTestSessionConnectHandler := examserviceconnect.NewExamTestSessionServiceHandler(examTestSessionHandler, opts...)
	mux.Handle(examTestSessionPath, examTestSessionConnectHandler)

	userPath, userConnectHandler := serviceconnect.NewUserServiceHandler(userHandler, opts...)
	mux.Handle(userPath, userConnectHandler)

	// mdm and tasks aren't implemented by this api at all — every request
	// under their service paths is forwarded byte-for-byte to the
	// upstream package service. See internal/proxy for the tradeoffs.
	mdmProxy := proxy.NewServicePassthrough(mdmURL)
	tasksProxy := proxy.NewServicePassthrough(tasksURL)
	// Аналитика опросов — свой сервис со своей БД; панель в fesmu только
	// читает результаты и заводит опросы. Анкеты по QR заполняют мимо fesmu.
	analyticsProxy := proxy.NewServicePassthrough(analyticsURL)
	// auth/v1 is frozen for sync and not routed here; fesmu speaks v2 only.
	authProxy := proxy.WithBearer(proxy.NewServicePassthrough(authURL), authToken,
		authv2connect.IdentityServiceFetchIdentityProcedure,
		authv2connect.IdentityServiceFetchIdentityByIDProcedure,
	)
	if authInterceptor != nil {
		// MDM — персональные данные (пользователи, студенты, сотрудники):
		// только администратору; список людей — ещё и тем, кто выдаёт справки
		// (выбор студента в журнале). Заявки — по правам раздела tickets.
		mdmProxy = authInterceptor.HTTPMiddleware(mdmAccess(mdmProxy))
		tasksProxy = authInterceptor.HTTPMiddleware(auth.RequireSectionHTTP(tasksProxy, auth.SectionTickets))
		// Только чтение: заводят и правят опросы через модуль survey (правила
		// номеров QR), ответы приходят через анкету (questionnaire).
		analyticsProxy = authInterceptor.HTTPMiddleware(auth.RequireSectionHTTP(
			proxy.AllowProcedures(analyticsProxy,
				analyticsserviceconnect.AnalyticServiceAnalyticByIDProcedure,
				analyticsserviceconnect.AnalyticServiceAnalyticFetchProcedure,
			), auth.SectionAnalytics))
		// The AD↔MDM link directory is the admin "Авторизация" page.
		authProxy = auth.RequireRoleHTTP(authProxy, []string{
			authv2connect.IdentityServiceFetchIdentityProcedure,
			authv2connect.IdentityServiceFetchIdentityByIDProcedure,
		}, auth.RoleAdmin)
		authProxy = authInterceptor.HTTPMiddleware(authProxy)
	}

	mux.Handle("/"+mdmserviceconnect.UserServiceName+"/", mdmProxy)
	mux.Handle("/"+mdmserviceconnect.UserDirectoryServiceName+"/", mdmProxy)
	mux.Handle("GET /users", mdmProxy)
	mux.Handle("/"+tasksserviceconnect.TicketDormitoryServiceName+"/", tasksProxy)
	mux.Handle("/"+tasksserviceconnect.TicketBuildServiceName+"/", tasksProxy)
	if requestsURL != "" {
		requestsProxy := proxy.NewServicePassthrough(requestsURL)
		mux.Handle(requestserviceconnect.TaskServiceCreateTaskProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.TaskServiceListMyTasksProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.TaskServiceGetMyTaskProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.TaskServiceGetMyTaskHistoryProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.TaskServiceListQueueTasksProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.TaskServiceGetQueueTaskProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.QueueAccessServiceGrantQueueViewAccessProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.QueueAccessServiceListQueueViewAccessProcedure, requestsProxy)
		mux.Handle(requestserviceconnect.QueueAccessServiceRevokeQueueViewAccessProcedure, requestsProxy)
	}
	mux.Handle("/"+analyticsserviceconnect.AnalyticServiceName+"/", analyticsProxy)
	mux.Handle("/"+authv2connect.IdentityServiceName+"/", authProxy)

	serviceNames := []string{
		serviceconnect.InventoryServiceName,
		serviceconnect.InfrastructureServiceName,
		serviceconnect.UserImportServiceName,
		serviceconnect.CertificateServiceName,
		serviceconnect.ScheduleServiceName,
		serviceconnect.ScheduleCollectServiceName,
		serviceconnect.HallServiceName,
		serviceconnect.ComputerClassServiceName,
		serviceconnect.VaccinationServiceName,
		serviceconnect.TestServiceName,
		serviceconnect.TestSessionServiceName,
		examserviceconnect.ExamTestServiceName,
		examserviceconnect.ExamTestSessionServiceName,
		serviceconnect.UserServiceName,
		mdmserviceconnect.UserServiceName,
		tasksserviceconnect.TicketDormitoryServiceName,
		tasksserviceconnect.TicketBuildServiceName,
		analyticsserviceconnect.AnalyticServiceName,
		authv2connect.IdentityServiceName,
	}
	for _, m := range modules {
		serviceNames = append(serviceNames, m.Mount(mux, opts...)...)
	}

	reflector := grpcreflect.NewStaticReflector(serviceNames...)
	mux.Handle(grpcreflect.NewHandlerV1(reflector))
	mux.Handle(grpcreflect.NewHandlerV1Alpha(reflector))

	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: corsHandler.Handler(h2c.NewHandler(mux, &http2.Server{})),
	}

	return &App{
		log:        log,
		httpServer: srv,
		port:       port,
	}
}

func (a *App) MustRun() {
	if err := a.Run(); err != nil {
		panic(err)
	}
}

func (a *App) Run() error {
	const op = "grpcapp.Run"
	a.log.Info("Connect RPC (gRPC/JSON) server started", slog.Int("port", a.port))
	if err := a.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("%s: %w", op, err)
	}
	return nil
}

func (a *App) Stop() {
	const op = "grpcapp.Stop"
	a.log.With(slog.String("op", op)).Info("stopping Connect RPC server", slog.Int("port", a.port))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := a.httpServer.Shutdown(ctx); err != nil {
		a.log.Error("server forced to shutdown", slog.String("error", err.Error()))
	}
}

// mdmAccess — доступ к прокси mdm: ADMIN, а UserFetch — и с правом выдачи
// справок.
func mdmAccess(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.UserFromContext(r.Context())
		if !ok {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if u.HasRole(auth.RoleAdmin) ||
			(r.URL.Path == mdmserviceconnect.UserServiceUserFetchProcedure && u.Can(auth.SectionCertificate, auth.ActionPost)) {
			next.ServeHTTP(w, r)
			return
		}
		w.WriteHeader(http.StatusForbidden)
	})
}
