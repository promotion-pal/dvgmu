package grpc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"connectrpc.com/grpcreflect"
	"fesmu/contract/tickets/service/serviceconnect"
	"github.com/rs/cors"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"

	ticketgrpc "dvgmu/tickets/internal/grpc"
)

type App struct {
	log        *slog.Logger
	httpServer *http.Server
	port       int
}

func New(log *slog.Logger, controller *ticketgrpc.TaskController, port int) *App {
	mux := http.NewServeMux()
	path, handler := serviceconnect.NewTaskServiceHandler(controller)
	mux.Handle(path, handler)
	reflector := grpcreflect.NewStaticReflector(serviceconnect.TaskServiceName)
	mux.Handle(grpcreflect.NewHandlerV1(reflector))
	mux.Handle(grpcreflect.NewHandlerV1Alpha(reflector))

	corsHandler := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"https://tickets.dvgmu.promotion-pal.ru",
		},
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
	a.log.Info("tickets gRPC server started", slog.Int("port", a.port))
	if err := a.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("run tickets server: %w", err)
	}
	return nil
}

func (a *App) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := a.httpServer.Shutdown(ctx); err != nil {
		a.log.Error("tickets server shutdown failed", slog.String("error", err.Error()))
	}
}
