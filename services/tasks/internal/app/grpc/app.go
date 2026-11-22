package grpc

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"dvgmu/tasks/internal/config"
	"fesmu/contract/tasks/service/serviceconnect"
)

type App struct {
	log        *slog.Logger
	httpServer *http.Server
	port       int
}

func New(
	log *slog.Logger,
	ping func(context.Context) error,
	cfg *config.Config,
	directions serviceconnect.DirectionServiceHandler,
	catalog serviceconnect.CatalogServiceHandler,
	statuses serviceconnect.StatusServiceHandler,
	priorities serviceconnect.PriorityServiceHandler,
	forms serviceconnect.ServiceFormServiceHandler,
) *App {
	mux := http.NewServeMux()
	if cfg.Env == "local" {
		mux.Handle(serviceconnect.NewDirectionServiceHandler(directions))
		mux.Handle(serviceconnect.NewCatalogServiceHandler(catalog))
		mux.Handle(serviceconnect.NewStatusServiceHandler(statuses))
		mux.Handle(serviceconnect.NewPriorityServiceHandler(priorities))
		mux.Handle(serviceconnect.NewServiceFormServiceHandler(forms))
	}
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), cfg.GRPC.Timeout)
		defer cancel()
		if err := ping(ctx); err != nil {
			http.Error(w, "database unavailable", http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusOK)
	})

	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)
	return &App{
		log: log,
		httpServer: &http.Server{
			Addr:              net.JoinHostPort(cfg.GRPC.Host, strconv.Itoa(cfg.GRPC.Port)),
			Handler:           mux,
			ReadHeaderTimeout: cfg.GRPC.Timeout,
			Protocols:         protocols,
		},
		port: cfg.GRPC.Port,
	}
}

func (a *App) MustRun() {
	if err := a.Run(); err != nil {
		panic(err)
	}
}

func (a *App) Run() error {
	a.log.Info("tasks HTTP server started", slog.Int("port", a.port))
	if err := a.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("run tasks HTTP server: %w", err)
	}
	return nil
}

func (a *App) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := a.httpServer.Shutdown(ctx); err != nil {
		a.log.Error("tasks server shutdown failed", slog.String("error", err.Error()))
	}
}
