package saml

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
	token "dvgmu/auth/internal/utils/token"
)

func testLoginHandler(t *testing.T, adfs ADFSAuthenticator, allowedHosts []string, defaultReturn string) *StandaloneLoginHandler {
	t.Helper()
	cfg := config.IdPConfig{CookieName: "dvgmu_session", CookieDomain: ".dvgmu.test", HelpDeskURL: "https://hd.fesmu.ru"}
	deps := SessionDeps{ADFS: adfs, Tokens: token.NewManager("test-secret", time.Hour), GUIDClaim: "objectGUID"}
	return NewStandaloneLoginHandler(cfg, deps, "https://auth.dvgmu.test/login", allowedHosts, defaultReturn)
}

func TestStandaloneLogin_GETShowsForm(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{}, []string{"app.dvgmu.test"}, "")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://auth.dvgmu.test/login?return="+url.QueryEscape("https://app.dvgmu.test/dashboard"), nil)
	h.ServeLogin(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body: %s", rec.Code, rec.Body.String())
	}
	body := rec.Body.String()
	if !strings.Contains(body, `name="username"`) {
		t.Fatalf("form missing: %s", body)
	}
	if !strings.Contains(body, `name="return" value="https://app.dvgmu.test/dashboard"`) {
		t.Fatalf("return not preserved as hidden field: %s", body)
	}
}

func TestStandaloneLogin_RejectsDisallowedReturnHost(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{}, []string{"app.dvgmu.test"}, "")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://auth.dvgmu.test/login?return="+url.QueryEscape("https://evil.example/steal"), nil)
	h.ServeLogin(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 for disallowed host", rec.Code)
	}
}

func TestStandaloneLogin_POSTIssuesCookieAndRedirects(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{assertion: cannedAssertion(t)}, []string{"app.dvgmu.test"}, "")

	form := url.Values{}
	form.Set("username", "ivanov@fesmu.ru")
	form.Set("password", "secret")
	form.Set("return", "https://app.dvgmu.test/dashboard")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://auth.dvgmu.test/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	h.ServeLogin(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, body: %s", rec.Code, rec.Body.String())
	}
	if loc := rec.Header().Get("Location"); loc != "https://app.dvgmu.test/dashboard" {
		t.Fatalf("redirect location = %q", loc)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) == 0 || cookies[0].Name != "dvgmu_session" || cookies[0].Value == "" {
		t.Fatalf("session cookie not set: %#v", cookies)
	}
	// net/http при парсинге Set-Cookie обрезает ведущую точку у Domain (RFC 6265).
	if cookies[0].Domain != "dvgmu.test" {
		t.Fatalf("cookie domain = %q", cookies[0].Domain)
	}
}

func TestStandaloneLogin_BadPasswordRerendersForm(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{err: mustErrInvalidCreds()}, []string{"app.dvgmu.test"}, "")

	form := url.Values{}
	form.Set("username", "ivanov@fesmu.ru")
	form.Set("password", "wrong")
	form.Set("return", "https://app.dvgmu.test/dashboard")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://auth.dvgmu.test/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	h.ServeLogin(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
	if len(rec.Result().Cookies()) != 0 {
		t.Fatalf("must not set a cookie on bad credentials")
	}
	if !strings.Contains(rec.Body.String(), "Неверный логин или пароль") {
		t.Fatalf("error banner missing: %s", rec.Body.String())
	}
}

func TestStandaloneLogin_ExistingCookieRedirectsWithoutPrompting(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{}, []string{"app.dvgmu.test"}, "")

	access, _, err := h.deps.Tokens.Issue(&models.User{Email: "ivanov@fesmu.ru", ExternalID: "11111111-1111-1111-1111-111111111111"}, token.ProviderSAML)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://auth.dvgmu.test/login?return="+url.QueryEscape("https://app.dvgmu.test/dashboard"), nil)
	req.AddCookie(&http.Cookie{Name: "dvgmu_session", Value: access})
	h.ServeLogin(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, want 302 (already has a valid session)", rec.Code)
	}
}

func TestStandaloneLogout_ClearsCookieAndRedirects(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{}, []string{"app.dvgmu.test"}, "")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://auth.dvgmu.test/logout?return="+url.QueryEscape("https://app.dvgmu.test/"), nil)
	h.ServeLogout(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d", rec.Code)
	}
	cookies := rec.Result().Cookies()
	if len(cookies) == 0 || cookies[0].Name != "dvgmu_session" || cookies[0].MaxAge >= 0 {
		t.Fatalf("cookie not cleared: %#v", cookies)
	}
}

func TestValidateReturnURL(t *testing.T) {
	cases := []struct {
		name          string
		raw           string
		allowed       []string
		fallback      string
		wantErr       bool
		wantSubstring string
	}{
		{"host allowed", "https://app.dvgmu.test/x", []string{"app.dvgmu.test"}, "", false, "https://app.dvgmu.test/x"},
		{"host case-insensitive", "https://APP.dvgmu.test/x", []string{"app.dvgmu.test"}, "", false, ""},
		{"host not allowed", "https://evil.example/x", []string{"app.dvgmu.test"}, "", true, ""},
		{"empty allow-list rejects explicit return", "https://app.dvgmu.test/x", nil, "", true, ""},
		{"fallback trusted without allow-list", "", nil, "https://app.dvgmu.test/x", false, "https://app.dvgmu.test/x"},
		{"nothing given at all", "", nil, "", true, ""},
		{"not absolute", "/relative/path", []string{"app.dvgmu.test"}, "", true, ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := validateReturnURL(c.raw, c.allowed, c.fallback)
			if c.wantErr {
				if err == nil {
					t.Fatalf("want error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if c.wantSubstring != "" && got != c.wantSubstring {
				t.Fatalf("got %q, want %q", got, c.wantSubstring)
			}
		})
	}
}

type fakeSessions struct {
	guids []string
	err   error
}

func (f *fakeSessions) Start(_ context.Context, w http.ResponseWriter, _ *http.Request, guid string) error {
	f.guids = append(f.guids, guid)
	if f.err == nil {
		http.SetCookie(w, &http.Cookie{Name: "fesmu_at", Value: "x"})
	}
	return f.err
}

func postLogin(h *StandaloneLoginHandler, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	form := url.Values{}
	form.Set("username", "ivanov@fesmu.ru")
	form.Set("password", "secret")
	form.Set("return", "https://app.dvgmu.test/dashboard")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "http://auth.dvgmu.test/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	for _, c := range cookies {
		req.AddCookie(c)
	}
	h.ServeLogin(rec, req)
	return rec
}

// Вход выдаёт токены fesmu; «не связан с MDM» вход не блокирует.
func TestStandaloneLogin_StartsFesmuSession(t *testing.T) {
	for _, tc := range []struct {
		name      string
		err       error
		wantFesmu bool
	}{
		{"linked", nil, true},
		{"not linked", utils.ErrNotLinked, false},
		{"mdm down", errors.New("mdm unreachable"), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := testLoginHandler(t, fakeADFS{assertion: cannedAssertion(t)}, []string{"app.dvgmu.test"}, "")
			sessions := &fakeSessions{err: tc.err}
			h.deps.Sessions = sessions

			rec := postLogin(h)
			if rec.Code != http.StatusFound {
				t.Fatalf("status = %d", rec.Code)
			}
			names := map[string]bool{}
			for _, c := range rec.Result().Cookies() {
				names[c.Name] = true
			}
			if !names["dvgmu_session"] || names["fesmu_at"] != tc.wantFesmu {
				t.Fatalf("cookies = %v", names)
			}
			if len(sessions.guids) != 1 || sessions.guids[0] == "" {
				t.Fatalf("Start calls = %v", sessions.guids)
			}
		})
	}
}

// Живая SSO-сессия: пароль не спрашиваем, но токены fesmu выдаём заново.
func TestStandaloneLogin_SSOReissuesFesmuTokens(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{}, []string{"app.dvgmu.test"}, "")
	sessions := &fakeSessions{}
	h.deps.Sessions = sessions

	sso, _, err := h.deps.Tokens.Issue(&models.User{ExternalID: "guid-1", Email: "ivanov@fesmu.ru"}, token.ProviderSAML)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://auth.dvgmu.test/login?return="+url.QueryEscape("https://app.dvgmu.test/"), nil)
	req.AddCookie(&http.Cookie{Name: "dvgmu_session", Value: sso})
	h.ServeLogin(rec, req)

	if rec.Code != http.StatusFound || len(sessions.guids) != 1 || sessions.guids[0] != "guid-1" {
		t.Fatalf("status = %d, Start calls = %v", rec.Code, sessions.guids)
	}
}

// ForceLogin: живая SSO-сессия не пропускает /login без пароля.
func TestStandaloneLogin_ForceLoginAsksPassword(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{}, []string{"app.dvgmu.test"}, "")
	h.cfg.ForceLogin = true
	sessions := &fakeSessions{}
	h.deps.Sessions = sessions

	sso, _, err := h.deps.Tokens.Issue(&models.User{ExternalID: "guid-1", Email: "ivanov@fesmu.ru"}, token.ProviderSAML)
	if err != nil {
		t.Fatal(err)
	}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://auth.dvgmu.test/login?return="+url.QueryEscape("https://app.dvgmu.test/"), nil)
	req.AddCookie(&http.Cookie{Name: "dvgmu_session", Value: sso})
	h.ServeLogin(rec, req)

	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `name="password"`) || len(sessions.guids) != 0 {
		t.Fatalf("status = %d, Start calls = %v, want the password form", rec.Code, sessions.guids)
	}
}

type fakeExpiry struct {
	must bool
	err  error
}

func (f fakeExpiry) MustChangePassword(string) (bool, error) { return f.must, f.err }

// AD FS отказал, а у учётки «сменить при входе» — на /password; иначе — обычная ошибка.
func TestStandaloneLogin_MustChangeRedirects(t *testing.T) {
	for _, tc := range []struct {
		name     string
		expiry   fakeExpiry
		redirect bool
	}{
		{"flag set", fakeExpiry{must: true}, true},
		{"no flag", fakeExpiry{}, false},
		{"check failed", fakeExpiry{err: errors.New("ldap down")}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := testLoginHandler(t, fakeADFS{err: mustErrInvalidCreds()}, []string{"app.dvgmu.test"}, "")
			h.cfg.BaseURL = "https://auth.dvgmu.test"
			h.deps.Expiry = tc.expiry
			rec := postLogin(h)
			loc := rec.Header().Get("Location")
			if tc.redirect {
				if rec.Code != http.StatusFound || !strings.Contains(loc, "/password?") || !strings.Contains(loc, "expired=1") ||
					!strings.Contains(loc, "username=ivanov%40fesmu.ru") || !strings.Contains(loc, "return=") {
					t.Fatalf("status=%d location=%q", rec.Code, loc)
				}
				return
			}
			if rec.Code == http.StatusFound || !strings.Contains(rec.Body.String(), "Неверный логин или пароль") {
				t.Fatalf("status=%d location=%q", rec.Code, loc)
			}
		})
	}
}
