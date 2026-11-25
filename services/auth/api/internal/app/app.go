package app

import (
	"log/slog"
	"strings"

	"gorm.io/gorm"

	"dvgmu/auth/internal/adfs"
	grpcapp "dvgmu/auth/internal/app/grpc"
	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/grpc"
	"dvgmu/auth/internal/kerberos"
	"dvgmu/auth/internal/ldap"
	"dvgmu/auth/internal/mdm"
	authsaml "dvgmu/auth/internal/saml"
	"dvgmu/auth/internal/service"
	"dvgmu/auth/internal/session"
	"dvgmu/auth/internal/storage"
	token "dvgmu/auth/internal/utils/token"
)

type App struct {
	GRPCServer *grpcapp.App
}

func (a *App) Stop() {
	a.GRPCServer.Stop()
}

func New(
	log *slog.Logger,
	cfg *config.Config,
) *App {
	db := buildDatabase(log, cfg)

	identitySvc := buildIdentityService(log, db)
	var identityHandler *grpc.IdentityHandler
	var identityV1Handler *grpc.IdentityV1Handler
	var mdmClient *mdm.Client
	if cfg.MDM.ServiceURL != "" {
		mdmClient = mdm.NewClient(cfg.MDM.ServiceURL, cfg.MDM.InternalToken)
	}
	if identitySvc != nil && mdmClient != nil {
		identitySvc.WithMDM(mdmClient)
	}
	if identitySvc != nil {
		identityHandler = grpc.IdentityNewController(identitySvc, cfg.Auth.InternalToken)
		identityV1Handler = grpc.IdentityV1NewController(identitySvc, cfg.Auth.InternalToken)
	}

	// SSO-сессия IdP (вход через AD) — у всех, кто вошёл, независимо от MDM.
	ssoTokens := token.NewManager(cfg.Auth.JWTSecret, cfg.Auth.AccessTokenTTL)
	sessions := buildSessions(log, cfg, db, mdmClient, authsaml.SSOCookie{Cfg: cfg.IdP, Tokens: ssoTokens})

	adClient := ldap.NewClient(ldap.Config{
		URL:                cfg.LDAP.URL,
		StartTLS:           cfg.LDAP.StartTLS,
		InsecureSkipVerify: cfg.LDAP.InsecureSkipVerify,
		BindDN:             cfg.LDAP.BindDN,
		BindPassword:       cfg.LDAP.BindPassword,
		BaseDN:             cfg.LDAP.BaseDN,
		UserFilter:         cfg.LDAP.UserFilter,
	})

	deps, adfsClient := buildSessionDeps(log, cfg, ssoTokens, adClient, identitySvc, sessions)
	if cfg.LDAP.URL != "" {
		deps.Expiry = adClient // только чтение pwdLastSet
	}
	idp := buildIdP(log, cfg, deps, adfsClient)
	loginHandler := buildStandaloneLogin(log, cfg, deps, adfsClient)
	accountHandler := buildAccount(log, cfg, deps, mdmClient)

	grpcApp := grpcapp.New(log, identityHandler, identityV1Handler, idp, loginHandler, accountHandler, sessions, cfg.GRPC.AllowedOrigins, cfg.GRPC.Port)

	return &App{GRPCServer: grpcApp}
}

func buildDatabase(log *slog.Logger, cfg *config.Config) *gorm.DB {
	if cfg.Database.DBName == "" {
		log.Warn("database disabled: AUTH_DB_NAME is empty")
		return nil
	}

	db, err := storage.New(cfg.Database, log)
	if err != nil {
		log.Error("database unreachable", "error", err.Error())
		return nil
	}
	return db
}

func buildIdentityService(log *slog.Logger, db *gorm.DB) *service.IdentityService {
	if db == nil {
		return nil
	}

	identityStorage := storage.IdentityStorageNew(db, log)
	if err := identityStorage.Migrate(); err != nil {
		log.Error("identity directory disabled: migrate failed", "error", err.Error())
		return nil
	}

	log.Info("identity directory enabled")
	return service.NewIdentityService(log, identityStorage, identityStorage)
}

// buildSessions — токены fesmu. Нужны mdm (поиск по objectGUID) и БД (refresh);
// без любого из них токены fesmu не выдаются, вход через AD работает.
func buildSessions(log *slog.Logger, cfg *config.Config, db *gorm.DB, mdmClient *mdm.Client, sso session.SSO) *session.Manager {
	if mdmClient == nil {
		log.Warn("fesmu sessions disabled: AUTH_MDM_SERVICE_URL is empty")
		return nil
	}
	if db == nil {
		log.Warn("fesmu sessions disabled: database is not configured (refresh tokens)")
		return nil
	}

	refreshStorage := storage.RefreshTokenStorageNew(db)
	if err := refreshStorage.Migrate(); err != nil {
		log.Error("fesmu sessions disabled: migrate refresh_tokens failed", "error", err.Error())
		return nil
	}

	signer, generated, err := session.LoadSigner(cfg.Session.SigningKeyPEM)
	if err != nil {
		log.Error("fesmu sessions disabled: signing key invalid", "error", err.Error())
		return nil
	}
	if generated {
		log.Warn("AUTH_JWT_SIGNING_KEY_PEM is empty — signing key generated, access tokens die on restart")
	}

	log.Info("fesmu sessions enabled",
		"mdm", cfg.MDM.ServiceURL,
		"cookie_domain", cfg.Session.CookieDomain,
		"access_ttl", cfg.Session.AccessTTL.String(),
		"refresh_ttl", cfg.Session.RefreshTTL.String(),
	)
	return session.NewManager(cfg.Session, signer, mdmClient, refreshStorage, sso, log)
}

func buildSessionDeps(
	log *slog.Logger,
	cfg *config.Config,
	ssoTokens *token.Manager,
	adClient *ldap.Client,
	identitySvc *service.IdentityService,
	sessions *session.Manager,
) (authsaml.SessionDeps, *adfs.Client) {
	relyingPartyID := cfg.ADFS.RelyingPartyID
	if relyingPartyID == "" {
		relyingPartyID = cfg.IdP.EntityID
	}

	adfsClient, err := adfs.NewClient(adfs.Config{
		WSTrustURL:         cfg.ADFS.WSTrustURL,
		RelyingPartyID:     relyingPartyID,
		SigningCertPEM:     cfg.ADFS.SigningCertPEM,
		InsecureSkipVerify: cfg.ADFS.InsecureSkipVerify,
		Timeout:            cfg.ADFS.Timeout,
	})
	if err != nil {
		log.Error("AD FS client config invalid: /saml/idp/* and /login disabled", "error", err.Error())
		return authsaml.SessionDeps{}, nil
	}

	var guidResolver authsaml.GUIDResolver
	if cfg.LDAP.URL != "" {
		guidResolver = adClient
	}

	// Реальный UPN из AD нужен только для NameID=upn (см. saml.resolveUser).
	var upnResolver authsaml.UPNResolver
	if cfg.LDAP.URL != "" && strings.EqualFold(cfg.IdP.NameIDSource, "upn") {
		upnResolver = adClient
	}

	var identityRecorder authsaml.IdentityRecorder
	if identitySvc != nil {
		identityRecorder = identitySvc
	}

	var fesmuSessions authsaml.FesmuSessions
	if sessions != nil {
		fesmuSessions = sessions
	}

	return authsaml.SessionDeps{
		ADFS:        adfsClient,
		GUID:        guidResolver,
		UPN:         upnResolver,
		Identities:  identityRecorder,
		Sessions:    fesmuSessions,
		Tokens:      ssoTokens,
		GUIDClaim:   cfg.ADFS.ObjectGUIDClaim,
		UPNSuffix:   cfg.ADFS.UPNSuffix,
		EmailDomain: cfg.IdP.EmailDomain,
		Log:         log,
	}, adfsClient
}

func buildIdP(log *slog.Logger, cfg *config.Config, deps authsaml.SessionDeps, adfsClient *adfs.Client) *authsaml.IdP {
	if adfsClient == nil {
		return nil
	}

	idp, err := authsaml.NewIdP(cfg.IdP, deps)
	if err != nil {
		log.Error("SAML IdP disabled: config invalid", "error", err.Error())
		return nil
	}
	if idp == nil {
		log.Warn("SAML IdP disabled: signing key not configured (AUTH_SAML_IDP_CERT_PEM / AUTH_SAML_IDP_KEY_PEM)")
		return nil
	}

	if !adfsClient.Enabled() {
		log.Warn("SAML IdP: AD FS WS-Trust endpoint not set (AUTH_ADFS_WSTRUST_URL) — /saml/idp/sso will fail on login until configured")
	}
	if !adfsClient.VerifiesSignature() {
		log.Warn("SAML IdP: AD FS assertion signature is NOT verified (AUTH_ADFS_SIGNING_CERT_PEM empty)")
	}
	log.Info("SAML IdP enabled",
		"entity_id", cfg.IdP.EntityID,
		"sso_url", cfg.IdP.BaseURL+authsaml.SSOPath,
		"sp_entity_id", cfg.IdP.SPEntityID,
	)

	return idp
}

// buildStandaloneLogin собирает /login+/logout для своих приложений (fesmu и
// др.). Нужен только рабочий AD FS — SAML-сертификат для этого пути не нужен.
func buildStandaloneLogin(log *slog.Logger, cfg *config.Config, deps authsaml.SessionDeps, adfsClient *adfs.Client) *authsaml.StandaloneLoginHandler {
	if adfsClient == nil || !adfsClient.Enabled() {
		log.Warn("/login disabled: AD FS WS-Trust endpoint not set (AUTH_ADFS_WSTRUST_URL)")
		return nil
	}

	loginURL := cfg.IdP.BaseURL + authsaml.LoginPath
	handler := authsaml.NewStandaloneLoginHandler(cfg.IdP, deps, loginURL, cfg.IdP.LoginAllowedReturnHosts, cfg.IdP.LoginDefaultReturnURL)

	if len(cfg.IdP.LoginAllowedReturnHosts) == 0 && cfg.IdP.LoginDefaultReturnURL == "" {
		log.Warn("/login enabled but every ?return= will be rejected: set AUTH_LOGIN_ALLOWED_RETURN_HOSTS or AUTH_LOGIN_DEFAULT_RETURN_URL")
	}
	log.Info("/login enabled", "login_url", loginURL, "allowed_return_hosts", cfg.IdP.LoginAllowedReturnHosts)
	return handler
}

// buildAccount — /activate и /password. Нужен mdm (коды) и служебная учётка
// AD для записи паролей; без неё страницы есть, но отвечают «недоступно».
func buildAccount(log *slog.Logger, cfg *config.Config, deps authsaml.SessionDeps, mdmClient *mdm.Client) *authsaml.AccountHandler {
	if mdmClient == nil || deps.Tokens == nil {
		log.Warn("/activate and /password disabled: AUTH_MDM_SERVICE_URL or AD FS is not configured")
		return nil
	}
	passwords := ldap.NewClient(ldap.Config{
		URL:                cfg.Password.URL,
		StartTLS:           cfg.Password.StartTLS,
		InsecureSkipVerify: cfg.Password.InsecureSkipVerify,
		BindDN:             cfg.Password.BindDN,
		BindPassword:       cfg.Password.BindPassword,
		BaseDN:             cfg.LDAP.BaseDN,
		UserFilter:         cfg.LDAP.UserFilter,
	})
	if passwords.Enabled() {
		log.Info("/activate and /password enabled", "url", cfg.Password.URL, "start_tls", cfg.Password.StartTLS, "bind_dn", cfg.Password.BindDN)
	} else {
		log.Warn("/activate and /password in stub mode (passwords are not written to AD): AUTH_LDAP_PWD_* is not set")
	}
	if cfg.MDM.InternalToken == "" {
		log.Warn("AUTH_MDM_INTERNAL_TOKEN is empty — mdm rejects activation code checks")
	}
	changer := kerberos.NewChanger(kerberos.Config{Realm: cfg.Kerberos.Realm, KDC: cfg.Kerberos.KDC, KPasswd: cfg.Kerberos.KPasswd})
	if changer.Enabled() {
		log.Info("/password: change through Kerberos", "realm", cfg.Kerberos.Realm, "kdc", cfg.Kerberos.KDC, "kpasswd", cfg.Kerberos.KPasswd)
	} else {
		log.Warn("/password in stub mode: AUTH_KRB_REALM is not set")
	}
	return authsaml.NewAccountHandler(cfg.IdP, deps, mdmClient, passwords, changer, cfg.IdP.LoginAllowedReturnHosts, cfg.IdP.LoginDefaultReturnURL)
}
