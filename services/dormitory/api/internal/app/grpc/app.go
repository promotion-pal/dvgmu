package grpc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"connectrpc.com/grpcreflect"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	"fesmu/contract/dormitory/service/serviceconnect"
	"dvgmu/analytics/internal/grpc"
)

type App struct {
	log        *slog.Logger
	httpServer *http.Server
	port       int
}

func New(
	log *slog.Logger,
	dormitoryHandler *grpc.DormitoryHandler,
	userHandler *grpc.UserHandler,
	reportHandler *grpc.ReportHandler,
	port int,
	corsAllowedOrigins []string,
) *App {
	mux := http.NewServeMux()

	if len(corsAllowedOrigins) == 0 {
		corsAllowedOrigins = []string{"http://localhost:3000"}
	}

	corsHandler := cors.New(cors.Options{
		AllowedOrigins: corsAllowedOrigins,
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

	dormitoryPath, dormitoryConnectHandler := serviceconnect.NewDormitoryServiceHandler(dormitoryHandler)
	mux.Handle(dormitoryPath, dormitoryConnectHandler)

	userPath, userConnectHandler := serviceconnect.NewUserServiceHandler(userHandler)
	mux.Handle(userPath, userConnectHandler)

	mux.HandleFunc("GET /admin/duty-roster.docx", reportHandler.DutyRoster)

	reflector := grpcreflect.NewStaticReflector(
		serviceconnect.DormitoryServiceName,
		serviceconnect.UserServiceName,
	)
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
