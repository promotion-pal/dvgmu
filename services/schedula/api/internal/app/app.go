package app

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"time"

	"connectrpc.com/connect"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"dvgmu/schedula"
	"dvgmu/schedula/internal/config"
	"dvgmu/schedula/internal/grpc"
	"dvgmu/schedula/internal/service"
	"dvgmu/schedula/internal/storage"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	"fesmu/contract/schedula/service/serviceconnect"
)

func Run(ctx context.Context, cfg config.Config, log *slog.Logger) error {
	location, err := time.LoadLocation(cfg.TimeZone)
	if err != nil {
		return fmt.Errorf("load university time zone: %w", err)
	}
	db, err := gorm.Open(postgres.Open(cfg.Database.DSN()), &gorm.Config{
		TranslateError: true, DisableAutomaticPing: true, Logger: logger.Discard,
	})
	if err != nil {
		return errors.New("open schedula database")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("obtain database pool: %w", err)
	}
	defer sqlDB.Close()
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)

	migrationFiles, err := fs.Sub(schedula.MigrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("open migrations: %w", err)
	}
	migrations, err := goose.NewProvider(goose.DialectPostgres, sqlDB, migrationFiles)
	if err != nil {
		return fmt.Errorf("initialize migrations: %w", err)
	}
	startup, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(startup); err != nil {
		return errors.New("connect to schedula database")
	}
	if _, err := migrations.Up(startup); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	users := mdmconnect.NewUserServiceClient(client, cfg.MDMURL)
	directory := mdmconnect.NewUserDirectoryServiceClient(client, cfg.MDMURL)
	students := grpc.Students(directory)
	controller := grpc.New(service.New(storage.New(db), location, students), users, directory, log)
	path, handler := serviceconnect.NewSchedulaServiceHandler(controller,
		connect.WithInterceptors(grpc.Authenticate(cfg.InternalToken, users)),
		connect.WithReadMaxBytes(1<<20),
	)
	mux := http.NewServeMux()
	mux.Handle(path, handler)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		ping, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(ping); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	protocols := new(http.Protocols)
	protocols.SetHTTP1(true)
	protocols.SetUnencryptedHTTP2(true)
	server := &http.Server{
		Addr: ":" + strconv.Itoa(cfg.Port), Handler: mux, Protocols: protocols,
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second,
		IdleTimeout: 60 * time.Second,
		BaseContext: func(net.Listener) context.Context { return ctx },
	}
	listener, err := net.Listen("tcp", server.Addr)
	if err != nil {
		return fmt.Errorf("listen for schedula requests: %w", err)
	}
	log.Info("schedula started", "port", cfg.Port)
	exited := make(chan error, 1)
	go func() {
		exited <- server.Serve(listener)
	}()
	select {
	case err := <-exited:
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}
