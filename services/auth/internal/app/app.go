package app

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"connectrpc.com/connect"
	authservice "dvgmu/auth"
	"dvgmu/auth/internal/auth"
	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/provider/authdb"
	"dvgmu/auth/internal/storage"
	"fesmu/contract/mdm/entity"
	mdmenum "fesmu/contract/mdm/enum"
	mdmservice "fesmu/contract/mdm/service"
	"fesmu/contract/mdm/service/serviceconnect"
	"github.com/pressly/goose/v3"
)

type App struct {
	server *http.Server
	log    *slog.Logger
}

func New(cfg config.Config, log *slog.Logger) (*App, error) {
	if cfg.Provider != "auth-test-db" && cfg.Provider != "test-db" {
		return nil, fmt.Errorf("unsupported AUTH_PROVIDER %q", cfg.Provider)
	}
	db, err := storage.Open(cfg.Database)
	if err != nil {
		return nil, fmt.Errorf("open Auth database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get Auth SQL database: %w", err)
	}
	if err := goose.SetDialect("postgres"); err != nil {
		return nil, err
	}
	goose.SetBaseFS(authservice.MigrationsFS)
	goose.SetTableName("goose_db_version_auth")
	if err := goose.Up(sqlDB, "db/migrations"); err != nil {
		return nil, fmt.Errorf("apply Auth migrations: %w", err)
	}

	identities := storage.NewIdentityStore(db)
	provider := authdb.New(identities)
	mapper := authdb.NewMapper(identities)
	mdm := serviceconnect.NewUserServiceClient(&http.Client{Timeout: 5 * time.Second}, cfg.MDMURL)
	core, err := auth.New(auth.Config{
		Port:         cfg.Port,
		JWTSecret:    cfg.JWTSecret,
		JWTIssuer:    cfg.JWTIssuer,
		TokenTTL:     15 * time.Minute,
		CookieSecure: cfg.CookieSecure,
		CookieDomain: cfg.CookieDomain,
	}, provider, mapper, mdmUserClient{client: mdm, internalToken: cfg.MDMInternalToken}, log)
	if err != nil {
		return nil, err
	}
	return &App{
		server: &http.Server{Addr: ":" + cfg.Port, Handler: core.Handler(), ReadHeaderTimeout: 5 * time.Second},
		log:    log,
	}, nil
}

func (a *App) Run() error {
	a.log.Info("Auth server started")
	if err := a.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (a *App) Stop() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = a.server.Shutdown(ctx)
}

type mdmUserClient struct {
	client        serviceconnect.UserServiceClient
	internalToken string
}

func (c mdmUserClient) UserFetchByID(ctx context.Context, id int64) (*auth.User, error) {
	request := connect.NewRequest(&mdmservice.UserFetchByIDRequest{Id: id})
	request.Header().Set("X-Internal-Service-Token", c.internalToken)
	response, err := c.client.UserFetchByID(ctx, request)
	if err != nil {
		return nil, err
	}
	user := response.Msg.GetUser()
	if user == nil {
		return nil, fmt.Errorf("MDM returned no user")
	}
	return mapMDMUser(user), nil
}

func mapMDMUser(user *entity.User) *auth.User {
	roles := make([]string, 0, len(user.GetRoles()))
	for _, role := range user.GetRoles() {
		if role != mdmenum.UserRole_USER_ROLE_UNSPECIFIED {
			roles = append(roles, role.String())
		}
	}
	permissions := make([]string, 0)
	if user.GetPermission() != nil {
		permissions = make([]string, 0, len(user.GetPermission().GetPermissions()))
		for _, permission := range user.GetPermission().GetPermissions() {
			if permission != mdmenum.UserPermission_USER_PERMISSION_UNSPECIFIED {
				permissions = append(permissions, permission.String())
			}
		}
	}
	return &auth.User{
		ID:          user.GetId(),
		UUID:        user.GetUuid(),
		Email:       user.GetEmail(),
		Active:      user.GetStatus() == mdmenum.UserStatus_USER_STATUS_ACTIVE,
		Roles:       roles,
		Permissions: permissions,
	}
}
