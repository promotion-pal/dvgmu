package saml

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	crewjamsaml "github.com/crewjam/saml"

	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
	token "dvgmu/auth/internal/utils/token"
)

const attrNameFormatBasic = "urn:oasis:names:tc:SAML:2.0:attrname-format:basic"

// ADFSAuthenticator — WS-Trust-клиент AD FS (см. internal/adfs).
type ADFSAuthenticator interface {
	RequestAssertion(ctx context.Context, username, password string) (*crewjamsaml.Assertion, error)
}

// GUIDResolver — fallback-поиск objectGUID по логину (см. internal/ldap).
type GUIDResolver interface {
	ObjectGUIDByLogin(login string) (string, error)
}

// UPNResolver — реальный userPrincipalName из AD по objectGUID (см. internal/ldap).
type UPNResolver interface {
	UPNByObjectGUID(guid string) (string, error)
}

// IdentityRecorder — журнал входов (identities: objectGUID, логин, email).
// Опционально: nil, если БД не сконфигурирована.
type IdentityRecorder interface {
	RecordLogin(ctx context.Context, guid, login, email string) error
}

// PasswordExpiry — стоит ли у учётки «сменить пароль при следующем входе»
// (см. internal/ldap.MustChangePassword: только чтение, без попытки входа —
// счётчик блокировки AD не трогается). Опционально.
type PasswordExpiry interface {
	MustChangePassword(login string) (bool, error)
}

// FesmuSessions — токены fesmu после входа (см. internal/session). Учётка не
// связана с MDM — utils.ErrNotLinked: вход (в т.ч. в Yandex 360) это не
// блокирует. Опционально: nil — токены fesmu не выдаются никому.
type FesmuSessions interface {
	Start(ctx context.Context, w http.ResponseWriter, r *http.Request, objectGUID string) error
}

// SessionDeps — зависимости провайдера сессий.
type SessionDeps struct {
	ADFS        ADFSAuthenticator
	GUID        GUIDResolver     // nil, если AUTH_LDAP_* не задан
	UPN         UPNResolver      // nil, если NameID != upn или AUTH_LDAP_* не задан
	Identities  IdentityRecorder // nil, если БД не сконфигурирована
	Sessions    FesmuSessions    // nil, если токены fesmu не настроены
	Expiry      PasswordExpiry   // nil — без перехода на смену пароля
	Tokens      *token.Manager
	GUIDClaim   string
	UPNSuffix   string // напр. "dvgmu.local"; пусто — логин не трогаем
	EmailDomain string // напр. "fesmu.ru"; пусто — email из ассерции обязателен
	Log         *slog.Logger
}

type sessionProvider struct {
	deps    SessionDeps
	cfg     config.IdPConfig
	formURL string
}

func newSessionProvider(cfg config.IdPConfig, formURL string, deps SessionDeps) *sessionProvider {
	if deps.Log == nil {
		deps.Log = slog.Default()
	}
	return &sessionProvider{deps: deps, cfg: cfg, formURL: formURL}
}

// GetSession реализует crewjamsaml.SessionProvider.
func (s *sessionProvider) GetSession(w http.ResponseWriter, r *http.Request, req *crewjamsaml.IdpAuthnRequest) *crewjamsaml.Session {
	if !s.cfg.ForceLogin {
		if sess := s.sessionFromCookie(r); sess != nil {
			return sess
		}
	}

	if r.Method == http.MethodPost && strings.TrimSpace(r.PostFormValue("username")) != "" {
		login := strings.TrimSpace(r.PostFormValue("username"))
		password := r.PostFormValue("password")

		sess, err := s.authenticate(r.Context(), w, r, login, password)
		if err != nil {
			s.deps.Log.Warn("saml idp: authentication failed", "login", login, "error", err.Error())
			if to, ok := mustChangeRedirect(s.deps, s.cfg, login, err, ""); ok {
				http.Redirect(w, r, to, http.StatusFound)
				return nil
			}
			s.renderLogin(w, req, messageFor(err))
			return nil
		}
		s.deps.Log.Info("saml idp: user authenticated", "login", login)
		return sess
	}

	s.renderLogin(w, req, "")
	return nil
}

func (s *sessionProvider) authenticate(
	ctx context.Context,
	w http.ResponseWriter,
	r *http.Request,
	login, password string,
) (*crewjamsaml.Session, error) {
	user, err := resolveUser(ctx, s.deps, login, password)
	if err != nil {
		return nil, err
	}

	accessToken, expiresAt, err := s.deps.Tokens.Issue(user, token.ProviderSAML)
	if err != nil {
		return nil, err
	}
	setCookie(w, r, s.cfg, accessToken, expiresAt)
	recordLoginJIT(ctx, s.deps, user)
	startFesmuSession(ctx, s.deps, w, r, user.ExternalID)

	return s.newSession(user.ExternalID, user.Email, user.UPN, user.FirstName, user.LastName), nil
}

// resolveUser — общее ядро логина: AD FS WS-Trust → атрибуты → objectGUID.
// Используется и SAML-потоком (Yandex), и обычной формой /login (см. login.go)
// для других приложений — единственное отличие между ними в том, что делают
// с результатом (SAML-Response против простого редиректа).
func resolveUser(ctx context.Context, deps SessionDeps, login, password string) (*models.User, error) {
	if password == "" {
		return nil, utils.ErrInvalidCredentials
	}

	login = normalizeLogin(deps.UPNSuffix, login)

	assertion, err := deps.ADFS.RequestAssertion(ctx, login, password)
	if err != nil {
		return nil, err
	}

	attrs, err := attrsFromAssertion(assertion, deps.GUIDClaim)
	if err != nil {
		return nil, err
	}

	if attrs.Email == "" {
		if deps.EmailDomain == "" {
			return nil, errors.New("assertion has no email attribute: заполните mail в AD или задайте AUTH_SAML_IDP_EMAIL_DOMAIN")
		}
		attrs.Email = localPart(login) + "@" + strings.TrimPrefix(deps.EmailDomain, "@")
	}

	// Диагностика: неполное ФИО от AD FS вход НЕ блокирует (что пришло, то и
	// уйдёт дальше как есть) — только пишем в лог сырые claim'ы, чтобы по
	// логам auth было видно, чего AD FS не прислал, не гадая руками.
	if attrs.FirstName == "" || attrs.LastName == "" {
		deps.Log.Warn("saml idp: incomplete name from AD FS assertion",
			"login", login, "first_name", attrs.FirstName, "last_name", attrs.LastName,
			"raw_attributes", dumpAttributes(assertion))
	}

	guid := attrs.ObjectGUID
	if guid == "" && deps.GUID != nil {
		guid, err = deps.GUID.ObjectGUIDByLogin(login)
		if err != nil {
			return nil, err
		}
	}
	if guid == "" {
		return nil, errors.New("objectGUID unavailable: configure AUTH_ADFS_OBJECT_GUID_CLAIM or AUTH_LDAP_*")
	}

	user := &models.User{
		Email:      attrs.Email,
		FirstName:  attrs.FirstName,
		LastName:   attrs.LastName,
		ExternalID: guid,
		UPN:        login,
	}

	// NameID=upn должен совпасть с логином, под которым SCIM завёл учётку в
	// Yandex 360, — то есть с userPrincipalName из AD, а не с тем, что человек
	// ввёл в форме (login@fesmu.ru / голый логин / DOMAIN\user). Несовпадение
	// → Yandex не находит учётку и пытается создать новую → email.exists.
	if deps.UPN != nil {
		upn, err := deps.UPN.UPNByObjectGUID(guid)
		if err != nil || upn == "" {
			deps.Log.Warn("saml idp: cannot read userPrincipalName from AD, NameID falls back to typed login",
				"guid", guid, "login", login, "error", errString(err))
		} else {
			user.UPN = upn
		}
	}

	return user, nil
}

// recordLoginJIT — best-effort подтверждение связки AD↔MDM; сбой не должен
// ломать логин.
func recordLoginJIT(ctx context.Context, deps SessionDeps, user *models.User) {
	if deps.Identities == nil {
		return
	}
	if err := deps.Identities.RecordLogin(ctx, user.ExternalID, user.UPN, user.Email); err != nil {
		deps.Log.Warn("identity: RecordLogin failed", "guid", user.ExternalID, "error", err.Error())
	}
}

// startFesmuSession — токены fesmu для связанных с MDM; сбой и «не связан»
// вход не ломают (Yandex 360 и SSO-сессия IdP от MDM не зависят).
func startFesmuSession(ctx context.Context, deps SessionDeps, w http.ResponseWriter, r *http.Request, guid string) {
	if deps.Sessions == nil {
		return
	}
	err := deps.Sessions.Start(ctx, w, r, guid)
	switch {
	case err == nil:
		deps.Log.Info("session: fesmu tokens issued", "guid", guid)
	case errors.Is(err, utils.ErrNotLinked):
		deps.Log.Info("session: account not linked to MDM, no fesmu tokens", "guid", guid)
	default:
		deps.Log.Warn("session: fesmu tokens not issued", "guid", guid, "error", err.Error())
	}
}

// SSOCookie — SSO-сессия IdP (cookie CookieName) для internal/session.
type SSOCookie struct {
	Cfg    config.IdPConfig
	Tokens *token.Manager
}

func (c SSOCookie) ObjectGUID(r *http.Request) (string, bool) {
	ck, err := r.Cookie(c.Cfg.CookieName)
	if err != nil {
		return "", false
	}
	claims, err := c.Tokens.Parse(ck.Value)
	if err != nil || claims.Subject == "" {
		return "", false
	}
	return claims.Subject, true
}

func (c SSOCookie) Clear(w http.ResponseWriter, r *http.Request) { clearCookie(w, r, c.Cfg) }

// normalizeLogin дописывает UPN-суффикс к логину без домена — AD FS
// usernamemixed не принимает голый sAMAccountName (ID3242). Логин с "@" или
// "\" (UPN / DOMAIN\user) и пустой суффикс — не трогаем.
func normalizeLogin(suffix, login string) string {
	login = strings.TrimSpace(login)
	suffix = strings.TrimPrefix(strings.TrimSpace(suffix), "@")
	if suffix == "" || strings.ContainsAny(login, `@\`) {
		return login
	}
	return login + "@" + suffix
}

// localPart вырезает sAMAccountName из "DOMAIN\user" / "user@domain".
func localPart(login string) string {
	if i := strings.LastIndexAny(login, `\`); i >= 0 {
		login = login[i+1:]
	}
	if i := strings.IndexByte(login, '@'); i >= 0 {
		login = login[:i]
	}
	return login
}

func (s *sessionProvider) sessionFromCookie(r *http.Request) *crewjamsaml.Session {
	c, err := r.Cookie(s.cfg.CookieName)
	if err != nil {
		return nil
	}
	claims, err := s.deps.Tokens.Parse(c.Value)
	if err != nil {
		return nil
	}
	return s.newSession(claims.Subject, claims.Email, claims.UPN, claims.FirstName, claims.LastName)
}

func (s *sessionProvider) newSession(guid, email, upn, firstName, lastName string) *crewjamsaml.Session {
	now := crewjamsaml.TimeNow()

	// По умолчанию NameID = email: Yandex 360 сопоставляет сотрудника по адресу.
	nameID, nameIDFormat := email, "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
	if strings.EqualFold(s.cfg.NameIDSource, "guid") {
		nameID, nameIDFormat = guid, s.cfg.NameIDFormat
	} else if strings.EqualFold(s.cfg.NameIDSource, "upn") {
		// UPN — тот же логин (с суффиксом домена), которым пользователя
		// провизионит SCIM-синхронизация (services/sync/yandex-scim) — им и
		// матчить SSO-вход с уже созданной учёткой в Yandex 360.
		nameID, nameIDFormat = upn, s.cfg.NameIDFormat
	}

	return &crewjamsaml.Session{
		ID:           randID(),
		CreateTime:   now,
		ExpireTime:   now.Add(s.deps.Tokens.TTL()),
		Index:        randID(),
		NameID:       nameID,
		NameIDFormat: nameIDFormat,
		CustomAttributes: []crewjamsaml.Attribute{
			yandexAttr("User.EmailAddress", email),
			yandexAttr("User.Firstname", firstName),
			yandexAttr("User.Surname", lastName),
		},
	}
}

// setCookie ставит сессионную cookie на родительский домен (видна всем
// приложениям на поддоменах) — общая точка и для SAML-потока, и для /login.
func setCookie(w http.ResponseWriter, r *http.Request, cfg config.IdPConfig, value string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CookieName,
		Value:    value,
		Path:     "/",
		Domain:   cfg.CookieDomain,
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	})
}

// clearCookie — для /logout.
func clearCookie(w http.ResponseWriter, r *http.Request, cfg config.IdPConfig) {
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CookieName,
		Value:    "",
		Path:     "/",
		Domain:   cfg.CookieDomain,
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   isHTTPS(r),
		SameSite: http.SameSiteLaxMode,
	})
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func yandexAttr(name, value string) crewjamsaml.Attribute {
	return crewjamsaml.Attribute{
		Name:       name,
		NameFormat: attrNameFormatBasic,
		Values:     []crewjamsaml.AttributeValue{{Type: "xs:string", Value: value}},
	}
}

func messageFor(err error) string {
	if errors.Is(err, utils.ErrInvalidCredentials) {
		return "Неверный логин или пароль"
	}
	return "Сервис аутентификации временно недоступен. Попробуйте позже."
}

func errString(err error) string {
	if err == nil {
		return "empty userPrincipalName"
	}
	return err.Error()
}

func randID() string {
	buf := make([]byte, 20)
	_, _ = rand.Read(buf)
	return "id-" + hex.EncodeToString(buf)
}

// mustChangeRedirect: AD FS отказал во входе, а у учётки стоит «сменить
// пароль при следующем входе» (первый вход с начальным паролем) — ведём на
// /password. Неверный пароль так не отличить от верного, поэтому на той
// странице текущий пароль проверяется заново.
func mustChangeRedirect(deps SessionDeps, cfg config.IdPConfig, login string, authErr error, returnURL string) (string, bool) {
	if deps.Expiry == nil || !errors.Is(authErr, utils.ErrInvalidCredentials) {
		return "", false
	}
	must, err := deps.Expiry.MustChangePassword(login)
	if err != nil {
		deps.Log.Warn("password expiry check failed", "login", login, "error", err.Error())
		return "", false
	}
	if !must {
		return "", false
	}
	q := url.Values{"username": {login}, "expired": {"1"}}
	if returnURL != "" {
		q.Set("return", returnURL)
	}
	return strings.TrimRight(cfg.BaseURL, "/") + PasswordPath + "?" + q.Encode(), true
}
