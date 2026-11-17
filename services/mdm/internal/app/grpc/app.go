package grpc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"connectrpc.com/grpcreflect"
	"fesmu/contract/mdm/service/serviceconnect"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	mdmgrpc "dvgmu/mdm/internal/grpc"
)

type App struct {
	log        *slog.Logger
	httpServer *http.Server
	port       int
}

func New(log *slog.Logger, controller *mdmgrpc.UserController, port int, allowedOrigins []string) *App {
	mux := http.NewServeMux()
	path, handler := serviceconnect.NewUserServiceHandler(controller)
	mux.Handle(path, handler)
	reflector := grpcreflect.NewStaticReflector(serviceconnect.UserServiceName)
	mux.Handle(grpcreflect.NewHandlerV1(reflector))
	mux.Handle(grpcreflect.NewHandlerV1Alpha(reflector))

	corsHandler := cors.New(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{"POST", "OPTIONS"},
		AllowedHeaders: []string{
			"Content-Type",
			"Connect-Protocol-Version",
			"Grpc-Timeout",
			"X-Grpc-Web",
			"X-User-Agent",
		},
		ExposedHeaders: []string{"Grpc-Status", "Grpc-Message", "Grpc-Status-Details-Bin"},
	})

	return &App{
		log: log,
		httpServer: &http.Server{
			Addr:              fmt.Sprintf(":%d", port),
			Handler:           corsHandler.Handler(h2c.NewHandler(mux, &http2.Server{})),
			ReadHeaderTimeout: 5 * time.Second,
		},
		port: port,
	}
}

func (a *App) MustRun() {
	if err := a.Run(); err != nil {
		panic(err)
	}
}

func (a *App) Run() error {
	a.log.Info("MDM Connect RPC server started", slog.Int("port", a.port))
	if err := a.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("run MDM server: %w", err)
	}
	return nil
}

func (a *App) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := a.httpServer.Shutdown(ctx); err != nil {
		a.log.Error("MDM server shutdown failed", slog.String("error", err.Error()))
	}
}
