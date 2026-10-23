package saml

import (
	"context"
	"errors"
	"html/template"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/kerberos"
	"dvgmu/auth/internal/ldap"
	"dvgmu/auth/internal/mdm"
	token "dvgmu/auth/internal/utils/token"
)

const (
	ActivatePath = "/activate"
	PasswordPath = "/password"

	minPasswordLen = 8
)

var accountTemplate = template.Must(template.ParseFS(templatesFS, "templates/account.html"))

// Activator — коды активации в MDM (см. internal/mdm.Client).
type Activator interface {
	ActivationVerify(ctx context.Context, username, code string) (*mdm.User, error)
	ActivationConsume(ctx context.Context, username, code string) (*mdm.User, error)
}

// PasswordWriter — установка пароля в AD служебной учёткой (активация, см.
// internal/ldap.SetPassword).
type PasswordWriter interface {
	Enabled() bool
	SetPassword(objectGUID, password string, enable bool) error
}

// PasswordChanger — смена пароля самим пользователем по текущему (Kerberos
// kpasswd, см. internal/kerberos): без служебной учётки.
type PasswordChanger interface {
	Enabled() bool
	Change(login, current, next string) error
}

// AccountHandler — /activate (первый вход по коду: задать пароль, включить
// учётку, сразу войти) и /password (смена пароля, в т.ч. «сменить при
// следующем входе», с которым AD FS не пускает).
type AccountHandler struct {
	deps               SessionDeps
	cfg                config.IdPConfig
	codes              Activator
	passwords          PasswordWriter
	changer            PasswordChanger
	baseURL            string
	allowedReturnHosts []string
	defaultReturnURL   string
	limiter            *rateLimiter
}

func NewAccountHandler(
	cfg config.IdPConfig,
	deps SessionDeps,
	codes Activator,
	passwords PasswordWriter,
	changer PasswordChanger,
	allowedReturnHosts []string,
	defaultReturnURL string,
) *AccountHandler {
	if deps.Log == nil {
		deps.Log = slog.Default()
	}
	return &AccountHandler{
		deps:               deps,
		cfg:                cfg,
		codes:              codes,
		passwords:          passwords,
		changer:            changer,
		baseURL:            strings.TrimRight(cfg.BaseURL, "/"),
		allowedReturnHosts: allowedReturnHosts,
		defaultReturnURL:   defaultReturnURL,
		limiter:            newRateLimiter(10, 5*time.Minute),
	}
}

type accountPage struct {
	Title     string
	Step      string // code | new | change | done
	FormURL   string
	LoginURL  string
	ReturnURL string
	Username  string
	Code      string
	Error     string
	Notice    string
}

const (
	msgUnavailable = "Сервис временно недоступен. Попробуйте позже."
	// Заглушка, пока нет служебной учётки AD (AUTH_LDAP_PWD_*): весь путь
	// проходится, но пароль в AD не пишется, код не гасится.
	msgStub   = "Тестовый режим: данные приняты, но пароль в AD пока не устанавливается — запись паролей включат после настройки служебной учётки. Код активации остаётся действующим."
	msgPolicy = "Пароль не подходит по требованиям домена: длиннее, с заглавными и строчными буквами и цифрами, не похожий на прежние и на имя."
)

// ServeActivate: шаг "code" — логин и код; шаг "new" — новый пароль.
func (h *AccountHandler) ServeActivate(w http.ResponseWriter, r *http.Request) {
	page, ok := h.page(w, r, "Активация учётной записи", ActivatePath)
	if !ok {
		return
	}
	page.Step = "code"
	if r.Method != http.MethodPost {
		h.render(w, page)
		return
	}
	if !h.limiter.allow(clientIP(r)) {
		page.Error = "Слишком много попыток. Подождите несколько минут."
		h.render(w, page)
		return
	}

	page.Username = strings.TrimSpace(r.PostFormValue("username"))
	page.Code = strings.TrimSpace(r.PostFormValue("code"))
	ctx := r.Context()

	// Код проверяется на каждом шаге заново: скрытое поле подделать можно.
	user, err := h.codes.ActivationVerify(ctx, page.Username, page.Code)
	if err != nil {
		page.Code = ""
		page.Error = activationMessage(err)
		h.deps.Log.Warn("activate: code rejected", "login", page.Username, "error", err.Error())
		h.render(w, page)
		return
	}
	if user.ADObjectID == "" {
		page.Error = "Учётная запись ещё создаётся. Попробуйте через час или обратитесь в Help Desk."
		h.render(w, page)
		return
	}

	page.Step = "new"
	if r.PostFormValue("step") != "set" {
		h.render(w, page)
		return
	}

	password := r.PostFormValue("password")
	if msg := checkNewPassword(password, r.PostFormValue("confirm")); msg != "" {
		page.Error = msg
		h.render(w, page)
		return
	}

	if !h.passwords.Enabled() {
		h.deps.Log.Info("activate: stub mode, password not written", "login", page.Username)
		page.Step = "done"
		page.Notice = msgStub
		h.render(w, page)
		return
	}

	// Сначала пароль в AD, код гасим только после: отказ по политике не
	// должен сжигать код.
	if err := h.passwords.SetPassword(user.ADObjectID, password, true); err != nil {
		page.Error = passwordMessage(err)
		h.deps.Log.Warn("activate: set password failed", "login", page.Username, "error", err.Error())
		h.render(w, page)
		return
	}
	if _, err := h.codes.ActivationConsume(ctx, page.Username, page.Code); err != nil {
		// Пароль уже стоит — повтор с тем же кодом безопасен.
		h.deps.Log.Error("activate: password set but code not consumed", "login", page.Username, "error", err.Error())
	}
	h.deps.Log.Info("activate: account activated", "login", page.Username, "guid", user.ADObjectID)

	h.signIn(w, r, user)
	http.Redirect(w, r, page.ReturnURL, http.StatusFound)
}

// ServePassword — смена пароля по текущему (в т.ч. «сменить при следующем
// входе» — сюда же ведёт форма входа). Меняет сам пользователь по Kerberos;
// после смены — на форму входа с новым паролем.
func (h *AccountHandler) ServePassword(w http.ResponseWriter, r *http.Request) {
	page, ok := h.page(w, r, "Смена пароля", PasswordPath)
	if !ok {
		return
	}
	page.Step = "change"
	if r.Method != http.MethodPost {
		page.Username = r.Form.Get("username")
		if r.Form.Get("expired") == "1" {
			page.Notice = "Это первый вход или срок пароля истёк: задайте свой пароль. Текущий — тот, что вам выдали."
		}
		h.render(w, page)
		return
	}
	page.Username = strings.TrimSpace(r.PostFormValue("username"))
	if !h.limiter.allow(clientIP(r)) {
		page.Error = "Слишком много попыток. Подождите несколько минут."
		h.render(w, page)
		return
	}

	password := r.PostFormValue("password")
	if msg := checkNewPassword(password, r.PostFormValue("confirm")); msg != "" {
		page.Error = msg
		h.render(w, page)
		return
	}
	if password == r.PostFormValue("current") {
		page.Error = "Новый пароль должен отличаться от текущего."
		h.render(w, page)
		return
	}

	if h.changer == nil || !h.changer.Enabled() {
		h.deps.Log.Info("password: stub mode, password not changed", "login", page.Username)
		page.Step = "done"
		page.Notice = "Тестовый режим: смена пароля пока не выполняется. Текущий пароль не изменён."
		h.render(w, page)
		return
	}

	if err := h.changer.Change(page.Username, r.PostFormValue("current"), password); err != nil {
		switch {
		case errors.Is(err, kerberos.ErrWrongPassword):
			page.Error = "Неверный логин или текущий пароль."
		case errors.Is(err, kerberos.ErrAccountDisabled):
			page.Error = "Учётная запись выключена или заблокирована. Обратитесь в Help Desk."
		case errors.Is(err, kerberos.ErrPasswordPolicy):
			page.Error = msgPolicy
		default:
			page.Error = msgUnavailable
		}
		h.deps.Log.Warn("password: change failed", "login", page.Username, "error", err.Error())
		h.render(w, page)
		return
	}
	h.deps.Log.Info("password: changed by user", "login", page.Username)

	page.Step = "done"
	page.Notice = "Пароль изменён. Войдите с новым паролем."
	h.render(w, page)
}

// page — общее для обеих страниц: разбор формы и проверка ?return= (как в /login).
func (h *AccountHandler) page(w http.ResponseWriter, r *http.Request, title, path string) (accountPage, bool) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return accountPage{}, false
	}
	returnURL, err := validateReturnURL(r.Form.Get("return"), h.allowedReturnHosts, h.defaultReturnURL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return accountPage{}, false
	}
	loginURL := h.baseURL + LoginPath + "?return=" + url.QueryEscape(returnURL)
	return accountPage{
		Title:     title,
		FormURL:   h.baseURL + path,
		LoginURL:  loginURL,
		ReturnURL: returnURL,
	}, true
}

// signIn — то же, что после /login: SSO-сессия IdP и токены fesmu.
func (h *AccountHandler) signIn(w http.ResponseWriter, r *http.Request, user *mdm.User) {
	sso, expiresAt, err := h.deps.Tokens.Issue(&models.User{
		Email:      user.Email,
		FirstName:  user.FirstName,
		LastName:   user.LastName,
		ExternalID: user.ADObjectID,
		UPN:        user.Username,
	}, token.ProviderSAML)
	if err != nil {
		h.deps.Log.Error("activate: issue sso token failed", "error", err.Error())
		return
	}
	setCookie(w, r, h.cfg, sso, expiresAt)
	startFesmuSession(r.Context(), h.deps, w, r, user.ADObjectID)
}

func (h *AccountHandler) render(w http.ResponseWriter, page accountPage) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if page.Error != "" {
		w.WriteHeader(http.StatusUnprocessableEntity)
	}
	if err := accountTemplate.Execute(w, page); err != nil {
		h.deps.Log.Error("account: render", "error", err.Error())
	}
}

func checkNewPassword(password, confirm string) string {
	switch {
	case len([]rune(password)) < minPasswordLen:
		return "Пароль должен быть не короче 8 символов."
	case password != confirm:
		return "Пароли не совпадают."
	}
	return ""
}

func activationMessage(err error) string {
	switch {
	case errors.Is(err, mdm.ErrActivationInvalid):
		return "Неверный логин или код, либо срок кода истёк."
	case errors.Is(err, mdm.ErrActivationLocked):
		return "Слишком много неверных попыток. Попросите у администратора новый код."
	}
	return msgUnavailable
}

func passwordMessage(err error) string {
	if errors.Is(err, ldap.ErrPasswordPolicy) {
		return msgPolicy
	}
	return msgUnavailable
}

// rateLimiter — не больше limit POST-запросов с одного IP за window.
type rateLimiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string][]time.Time
}

func newRateLimiter(limit int, window time.Duration) *rateLimiter {
	return &rateLimiter{limit: limit, window: window, hits: map[string][]time.Time{}}
}

func (l *rateLimiter) allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	recent := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if now.Sub(t) < l.window {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}

func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		ip, _, _ := strings.Cut(fwd, ",")
		return strings.TrimSpace(ip)
	}
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}
