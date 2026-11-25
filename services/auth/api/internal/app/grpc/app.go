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

	authv1connect "fesmu/contract/auth/v1/v1connect"
	"fesmu/contract/auth/v2/authv2connect"
	"dvgmu/auth/internal/grpc"
	authsaml "dvgmu/auth/internal/saml"
	"dvgmu/auth/internal/session"
)

type App struct {
	log        *slog.Logger
	httpServer *http.Server
	port       int
}

func New(
	log *slog.Logger,
	identityHandler *grpc.IdentityHandler,
	identityV1Handler *grpc.IdentityV1Handler,
	idp *authsaml.IdP,
	loginHandler *authsaml.StandaloneLoginHandler,
	accountHandler *authsaml.AccountHandler,
	sessions *session.Manager,
	allowedOrigins []string,
	port int,
) *App {
	mux := http.NewServeMux()

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

	var reflectServices []string

	if identityHandler != nil {
		identityPath, identityConnectHandler := authv2connect.NewIdentityServiceHandler(identityHandler)
		mux.Handle(identityPath, identityConnectHandler)
		reflectServices = append(reflectServices, authv2connect.IdentityServiceName)
	}

	if identityV1Handler != nil {
		identityPath, identityConnectHandler := authv1connect.NewIdentityServiceHandler(identityV1Handler)
		mux.Handle(identityPath, identityConnectHandler)
		reflectServices = append(reflectServices, authv1connect.IdentityServiceName)
	}

	reflector := grpcreflect.NewStaticReflector(reflectServices...)
	mux.Handle(grpcreflect.NewHandlerV1(reflector))
	mux.Handle(grpcreflect.NewHandlerV1Alpha(reflector))

	// Вход через AD: SAML для Yandex 360 и /login для своих приложений.
	if idp != nil {
		mux.HandleFunc(authsaml.MetadataPath, idp.ServeMetadata)
		mux.HandleFunc(authsaml.SSOPath, idp.ServeSSO)
	}
	if loginHandler != nil {
		mux.HandleFunc(authsaml.LoginPath, loginHandler.ServeLogin)
		mux.HandleFunc(authsaml.LogoutPath, loginHandler.ServeLogout)
	}
	if accountHandler != nil {
		mux.HandleFunc(authsaml.ActivatePath, accountHandler.ServeActivate)
		mux.HandleFunc(authsaml.PasswordPath, accountHandler.ServePassword)
	}

	// Токены fesmu.
	if sessions != nil {
		mux.HandleFunc(session.MePath, sessions.ServeMe)
		mux.HandleFunc(session.RefreshPath, sessions.ServeRefresh)
		mux.HandleFunc(session.LogoutPath, sessions.ServeLogout)
		mux.HandleFunc(session.JWKSPath, sessions.ServeJWKS)
	}

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
