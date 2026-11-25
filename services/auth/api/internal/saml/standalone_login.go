package saml

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"dvgmu/auth/internal/config"
	token "dvgmu/auth/internal/utils/token"
)

// StandaloneLoginHandler — /login и /logout: тот же вход через AD FS
// (resolveUser, см. session.go), что и SAML-поток для Yandex, но без SAML —
// просто ставит cookie и редиректит обратно в приложение-потребитель
// (?return=). Нужен любому обычному сайту/сервису на *.dvgmu.promotion-pal.ru,
// который сам не является SAML SP (SAML — только для Yandex 360).
type StandaloneLoginHandler struct {
	deps               SessionDeps
	cfg                config.IdPConfig
	loginURL           string
	allowedReturnHosts []string
	defaultReturnURL   string
}

func NewStandaloneLoginHandler(
	cfg config.IdPConfig,
	deps SessionDeps,
	loginURL string,
	allowedReturnHosts []string,
	defaultReturnURL string,
) *StandaloneLoginHandler {
	if deps.Log == nil {
		deps.Log = slog.Default()
	}
	return &StandaloneLoginHandler{
		deps:               deps,
		cfg:                cfg,
		loginURL:           loginURL,
		allowedReturnHosts: allowedReturnHosts,
		defaultReturnURL:   defaultReturnURL,
	}
}

// ServeLogin: GET показывает форму (или сразу редиректит, если cookie уже
// валидна); POST с username/password проверяет их через AD FS, ставит cookie
// и редиректит на ?return=.
func (h *StandaloneLoginHandler) ServeLogin(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	returnURL, err := validateReturnURL(r.Form.Get("return"), h.allowedReturnHosts, h.defaultReturnURL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Без ForceLogin: уже вошёл через AD (SSO-сессия жива) — пароль не
	// спрашиваем, но токены fesmu выдаём заново: они могли истечь. С
	// ForceLogin пароль спрашивается при каждом входе.
	if guid, ok := (SSOCookie{Cfg: h.cfg, Tokens: h.deps.Tokens}).ObjectGUID(r); ok && !h.cfg.ForceLogin {
		startFesmuSession(r.Context(), h.deps, w, r, guid)
		http.Redirect(w, r, returnURL, http.StatusFound)
		return
	}

	if r.Method == http.MethodPost && strings.TrimSpace(r.PostFormValue("username")) != "" {
		login := strings.TrimSpace(r.PostFormValue("username"))
		password := r.PostFormValue("password")

		user, err := resolveUser(r.Context(), h.deps, login, password)
		if err != nil {
			h.deps.Log.Warn("login: authentication failed", "login", login, "error", err.Error())
			if to, ok := mustChangeRedirect(h.deps, h.cfg, login, err, returnURL); ok {
				http.Redirect(w, r, to, http.StatusFound)
				return
			}
			h.renderForm(w, messageFor(err), returnURL)
			return
		}

		accessToken, expiresAt, err := h.deps.Tokens.Issue(user, token.ProviderSAML)
		if err != nil {
			h.deps.Log.Error("login: issue token failed", "error", err.Error())
			h.renderForm(w, "Сервис аутентификации временно недоступен. Попробуйте позже.", returnURL)
			return
		}
		setCookie(w, r, h.cfg, accessToken, expiresAt)
		recordLoginJIT(r.Context(), h.deps, user)
		startFesmuSession(r.Context(), h.deps, w, r, user.ExternalID)

		h.deps.Log.Info("login: user authenticated", "login", login)
		http.Redirect(w, r, returnURL, http.StatusFound)
		return
	}

	h.renderForm(w, "", returnURL)
}

func (h *StandaloneLoginHandler) renderForm(w http.ResponseWriter, errMsg, returnURL string) {
	writeLoginPage(w, h.deps.Log, loginFormData{
		FormURL:     h.loginURL,
		Error:       errMsg,
		HelpDeskURL: h.cfg.HelpDeskURL,
		ReturnURL:   returnURL,
	})
}

// ServeLogout стирает cookie и возвращает на ?return= (или дефолт).
func (h *StandaloneLoginHandler) ServeLogout(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	returnURL, err := validateReturnURL(r.Form.Get("return"), h.allowedReturnHosts, h.defaultReturnURL)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	clearCookie(w, r, h.cfg)
	http.Redirect(w, r, returnURL, http.StatusFound)
}

// validateReturnURL — защита от open redirect. usedFallback (дефолт из
// конфига, не от пользователя) доверяем без сверки с allow-list.
func validateReturnURL(raw string, allowedHosts []string, fallback string) (string, error) {
	usedFallback := raw == ""
	if usedFallback {
		raw = fallback
	}
	if raw == "" {
		return "", fmt.Errorf("query param 'return' is required (no AUTH_LOGIN_DEFAULT_RETURN_URL configured)")
	}

	u, err := url.Parse(raw)
	if err != nil || !u.IsAbs() || u.Host == "" {
		return "", fmt.Errorf("'return' must be an absolute URL")
	}
	if usedFallback {
		return raw, nil
	}

	if len(allowedHosts) == 0 {
		return "", fmt.Errorf("return host %q is not allowed (AUTH_LOGIN_ALLOWED_RETURN_HOSTS is empty)", u.Host)
	}
	for _, host := range allowedHosts {
		if strings.EqualFold(u.Host, strings.TrimSpace(host)) {
			return raw, nil
		}
	}
	return "", fmt.Errorf("return host %q is not in AUTH_LOGIN_ALLOWED_RETURN_HOSTS", u.Host)
}
