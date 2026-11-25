package saml

import (
	"embed"
	"encoding/base64"
	"html/template"
	"log/slog"
	"net/http"

	crewjamsaml "github.com/crewjam/saml"
)

//go:embed templates/*.html
var templatesFS embed.FS

var loginTemplate = template.Must(template.ParseFS(templatesFS, "templates/login.html"))

type loginFormData struct {
	FormURL     string
	Error       string
	HelpDeskURL string
	SAMLRequest string
	RelayState  string
	ReturnURL   string
}

// renderLogin отдаёт форму логина для SAML-потока (Yandex). Скрытые поля
// SAMLRequest/RelayState возвращают поток на тот же /saml/idp/sso после
// ввода учётных данных.
func (s *sessionProvider) renderLogin(w http.ResponseWriter, req *crewjamsaml.IdpAuthnRequest, errMsg string) {
	data := loginFormData{
		FormURL:     s.formURL,
		Error:       errMsg,
		HelpDeskURL: s.cfg.HelpDeskURL,
	}
	if req != nil {
		data.SAMLRequest = base64.StdEncoding.EncodeToString(req.RequestBuffer)
		data.RelayState = req.RelayState
	}
	writeLoginPage(w, s.deps.Log, data)
}

// writeLoginPage — общий рендер страницы логина: и для SAML-потока (Yandex),
// и для обычного /login (см. login.go, другие приложения).
// Блок с Help Desk показывается всегда (не только после ошибки) — у части
// учёток AD email не настроен/кривой, и человек может не дойти до сообщения
// об ошибке, а просто не понимать, к кому обращаться.
func writeLoginPage(w http.ResponseWriter, log *slog.Logger, data loginFormData) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if data.Error != "" {
		w.WriteHeader(http.StatusUnauthorized)
	}
	if err := loginTemplate.Execute(w, data); err != nil {
		log.Error("saml idp: render login form", "error", err.Error())
	}
}
