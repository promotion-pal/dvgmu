package saml

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/kerberos"
	"dvgmu/auth/internal/ldap"
	"dvgmu/auth/internal/mdm"
	token "dvgmu/auth/internal/utils/token"
)

const accountGUID = "42bd25e2-69bf-401e-9877-e51c1c6a2958"

type fakeCodes struct {
	user     *mdm.User
	code     string
	consumed int
}

func (f *fakeCodes) check(username, code string) (*mdm.User, error) {
	if f.user == nil || !strings.EqualFold(username, f.user.Username) || code != f.code {
		return nil, mdm.ErrActivationInvalid
	}
	return f.user, nil
}

func (f *fakeCodes) ActivationVerify(_ context.Context, username, code string) (*mdm.User, error) {
	return f.check(username, code)
}

func (f *fakeCodes) ActivationConsume(_ context.Context, username, code string) (*mdm.User, error) {
	u, err := f.check(username, code)
	if err == nil {
		f.consumed++
		f.code = "" // погашен
	}
	return u, err
}

type setCall struct {
	guid, password string
	enable         bool
}

type fakePasswords struct {
	disabled bool
	setErr   error
	current  string
	sets     []setCall
}

func (f *fakePasswords) Enabled() bool { return !f.disabled }

func (f *fakePasswords) SetPassword(guid, password string, enable bool) error {
	if f.setErr != nil {
		return f.setErr
	}
	f.sets = append(f.sets, setCall{guid, password, enable})
	return nil
}

type changeCall struct{ login, current, next string }

type fakeChanger struct {
	disabled bool
	current  string
	err      error
	calls    []changeCall
}

func (f *fakeChanger) Enabled() bool { return !f.disabled }

func (f *fakeChanger) Change(login, current, next string) error {
	if f.err != nil {
		return f.err
	}
	if current != f.current {
		return kerberos.ErrWrongPassword
	}
	f.calls = append(f.calls, changeCall{login, current, next})
	return nil
}

func newAccount(t *testing.T, codes *fakeCodes, pw *fakePasswords) (*AccountHandler, *fakeSessions) {
	t.Helper()
	return newAccountWith(t, codes, pw, &fakeChanger{disabled: true})
}

func newAccountWith(t *testing.T, codes *fakeCodes, pw *fakePasswords, changer *fakeChanger) (*AccountHandler, *fakeSessions) {
	t.Helper()
	sessions := &fakeSessions{}
	cfg := config.IdPConfig{BaseURL: "https://auth.dvgmu.test", CookieName: "dvgmu_session", CookieDomain: ".dvgmu.test"}
	deps := SessionDeps{Tokens: token.NewManager("test-secret", time.Hour), Sessions: sessions}
	return NewAccountHandler(cfg, deps, codes, pw, changer, []string{"app.dvgmu.test"}, ""), sessions
}

func post(h http.HandlerFunc, path string, form url.Values) *httptest.ResponseRecorder {
	form.Set("return", "https://app.dvgmu.test/")
	req := httptest.NewRequest(http.MethodPost, "https://auth.dvgmu.test"+path, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.RemoteAddr = "10.0.0.1:1234"
	rec := httptest.NewRecorder()
	h(rec, req)
	return rec
}

func student() *fakeCodes {
	return &fakeCodes{
		user: &mdm.User{UUID: "u-1", Username: "ivanov_ii", Email: "ivanov_ii@fesmu.ru", ADObjectID: accountGUID, Active: true},
		code: "AB3D-EF7H",
	}
}

func TestActivate_FullFlow(t *testing.T) {
	codes, pw := student(), &fakePasswords{}
	h, sessions := newAccount(t, codes, pw)

	rec := post(h.ServeActivate, ActivatePath, url.Values{"username": {"Ivanov_II"}, "code": {"AB3D-EF7H"}, "step": {"code"}})
	if !strings.Contains(rec.Body.String(), `name="step" value="set"`) {
		t.Fatalf("expected new-password step: %d %s", rec.Code, rec.Body.String())
	}

	rec = post(h.ServeActivate, ActivatePath, url.Values{
		"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}, "step": {"set"},
		"password": {"Str0ngPass"}, "confirm": {"Str0ngPass"},
	})
	if rec.Code != http.StatusFound || rec.Header().Get("Location") != "https://app.dvgmu.test/" {
		t.Fatalf("status = %d, location = %q, body: %s", rec.Code, rec.Header().Get("Location"), rec.Body.String())
	}
	if len(pw.sets) != 1 || pw.sets[0] != (setCall{accountGUID, "Str0ngPass", true}) {
		t.Fatalf("SetPassword calls = %+v (must enable the account)", pw.sets)
	}
	if codes.consumed != 1 {
		t.Fatalf("code consumed %d times", codes.consumed)
	}
	var sso bool
	for _, c := range rec.Result().Cookies() {
		sso = sso || c.Name == "dvgmu_session"
	}
	if !sso || len(sessions.guids) != 1 || sessions.guids[0] != accountGUID {
		t.Fatalf("not signed in: sso=%v fesmu=%v", sso, sessions.guids)
	}
}

func TestActivate_PolicyRejectKeepsCode(t *testing.T) {
	codes, pw := student(), &fakePasswords{setErr: ldap.ErrPasswordPolicy}
	h, _ := newAccount(t, codes, pw)

	rec := post(h.ServeActivate, ActivatePath, url.Values{
		"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}, "step": {"set"},
		"password": {"password1"}, "confirm": {"password1"},
	})
	if !strings.Contains(rec.Body.String(), "требованиям домена") || codes.consumed != 0 {
		t.Fatalf("policy reject: consumed=%d body=%s", codes.consumed, rec.Body.String())
	}
	// Тот же код работает со вторым паролем.
	pw.setErr = nil
	rec = post(h.ServeActivate, ActivatePath, url.Values{
		"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}, "step": {"set"},
		"password": {"Str0ngPass"}, "confirm": {"Str0ngPass"},
	})
	if rec.Code != http.StatusFound || codes.consumed != 1 {
		t.Fatalf("retry: %d consumed=%d", rec.Code, codes.consumed)
	}
}

func TestActivate_Rejections(t *testing.T) {
	cases := []struct {
		name  string
		codes *fakeCodes
		pw    *fakePasswords
		form  url.Values
		want  string
	}{
		{"wrong code", student(), &fakePasswords{},
			url.Values{"username": {"ivanov_ii"}, "code": {"ZZZZ-ZZZZ"}}, "Неверный логин или код"},
		{"passwords differ", student(), &fakePasswords{},
			url.Values{"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}, "step": {"set"}, "password": {"Str0ngPass"}, "confirm": {"Other0Pass"}}, "не совпадают"},
		{"too short", student(), &fakePasswords{},
			url.Values{"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}, "step": {"set"}, "password": {"Ab1"}, "confirm": {"Ab1"}}, "не короче 8"},
		{"no AD account yet", func() *fakeCodes { c := student(); c.user.ADObjectID = ""; return c }(), &fakePasswords{},
			url.Values{"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}}, "ещё создаётся"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h, _ := newAccount(t, tc.codes, tc.pw)
			rec := post(h.ServeActivate, ActivatePath, tc.form)
			if !strings.Contains(rec.Body.String(), tc.want) {
				t.Fatalf("want %q in: %s", tc.want, rec.Body.String())
			}
			if len(tc.pw.sets) != 0 || tc.codes.consumed != 0 {
				t.Fatalf("nothing must change: sets=%v consumed=%d", tc.pw.sets, tc.codes.consumed)
			}
		})
	}
}

func TestActivate_RateLimit(t *testing.T) {
	h, _ := newAccount(t, student(), &fakePasswords{})
	var rec *httptest.ResponseRecorder
	for range 11 {
		rec = post(h.ServeActivate, ActivatePath, url.Values{"username": {"ivanov_ii"}, "code": {"ZZZZ-ZZZZ"}})
	}
	if !strings.Contains(rec.Body.String(), "Слишком много попыток") {
		t.Fatalf("11th attempt not limited: %s", rec.Body.String())
	}
}

func TestPassword_Change(t *testing.T) {
	changer := &fakeChanger{current: "OldPass123"}
	h, _ := newAccountWith(t, &fakeCodes{}, &fakePasswords{}, changer)

	rec := post(h.ServePassword, PasswordPath, url.Values{"username": {"ivanov_ii"}, "current": {"wrong"}, "password": {"NewPass123"}, "confirm": {"NewPass123"}})
	if !strings.Contains(rec.Body.String(), "Неверный логин или текущий пароль") || len(changer.calls) != 0 {
		t.Fatalf("wrong current: %s", rec.Body.String())
	}

	rec = post(h.ServePassword, PasswordPath, url.Values{"username": {"ivanov_ii"}, "current": {"OldPass123"}, "password": {"OldPass123"}, "confirm": {"OldPass123"}})
	if !strings.Contains(rec.Body.String(), "должен отличаться") {
		t.Fatalf("same password: %s", rec.Body.String())
	}

	changer.err = kerberos.ErrPasswordPolicy
	rec = post(h.ServePassword, PasswordPath, url.Values{"username": {"ivanov_ii"}, "current": {"OldPass123"}, "password": {"weakpass1"}, "confirm": {"weakpass1"}})
	if !strings.Contains(rec.Body.String(), "требованиям домена") {
		t.Fatalf("policy: %s", rec.Body.String())
	}

	changer.err = nil
	rec = post(h.ServePassword, PasswordPath, url.Values{"username": {"ivanov_ii"}, "current": {"OldPass123"}, "password": {"NewPass123"}, "confirm": {"NewPass123"}})
	if !strings.Contains(rec.Body.String(), "Пароль изменён") {
		t.Fatalf("change: %s", rec.Body.String())
	}
	if len(changer.calls) != 1 || changer.calls[0] != (changeCall{"ivanov_ii", "OldPass123", "NewPass123"}) {
		t.Fatalf("Change calls = %+v", changer.calls)
	}
}

func TestPassword_ExpiredNotice(t *testing.T) {
	h, _ := newAccount(t, &fakeCodes{}, &fakePasswords{})
	rec := httptest.NewRecorder()
	h.ServePassword(rec, httptest.NewRequest(http.MethodGet, "https://auth.dvgmu.test/password?expired=1&username=ivanov_ii&return="+url.QueryEscape("https://app.dvgmu.test/"), nil))
	body := rec.Body.String()
	if !strings.Contains(body, "Это первый вход") || !strings.Contains(body, `value="ivanov_ii"`) {
		t.Fatalf("expired notice / prefilled login missing: %s", body)
	}
}

func TestLoginForm_LinksToAccountPages(t *testing.T) {
	h := testLoginHandler(t, fakeADFS{}, []string{"app.dvgmu.test"}, "")
	rec := httptest.NewRecorder()
	h.ServeLogin(rec, httptest.NewRequest(http.MethodGet, "http://auth.dvgmu.test/login?return="+url.QueryEscape("https://app.dvgmu.test/x"), nil))
	body := rec.Body.String()
	if !strings.Contains(body, `/activate?return=https%3a%2f%2fapp.dvgmu.test%2fx`) || !strings.Contains(body, `/password?return=`) {
		t.Fatalf("links missing: %s", body)
	}
}

// Без служебной учётки AD — заглушка: путь проходится, пароль не пишется,
// код не гасится, вход не выполняется.
func TestActivate_StubWithoutADWrite(t *testing.T) {
	codes, pw := student(), &fakePasswords{disabled: true}
	h, sessions := newAccount(t, codes, pw)

	rec := post(h.ServeActivate, ActivatePath, url.Values{"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}, "step": {"code"}})
	if !strings.Contains(rec.Body.String(), `name="step" value="set"`) {
		t.Fatalf("code step: %s", rec.Body.String())
	}
	rec = post(h.ServeActivate, ActivatePath, url.Values{
		"username": {"ivanov_ii"}, "code": {"AB3D-EF7H"}, "step": {"set"},
		"password": {"Str0ngPass"}, "confirm": {"Str0ngPass"},
	})
	if !strings.Contains(rec.Body.String(), "Тестовый режим") {
		t.Fatalf("stub notice missing: %d %s", rec.Code, rec.Body.String())
	}
	if len(pw.sets) != 0 || codes.consumed != 0 || len(sessions.guids) != 0 {
		t.Fatalf("stub must not write: sets=%v consumed=%d sessions=%v", pw.sets, codes.consumed, sessions.guids)
	}

	// Неверный код и в заглушке отвергается.
	rec = post(h.ServeActivate, ActivatePath, url.Values{"username": {"ivanov_ii"}, "code": {"ZZZZ-ZZZZ"}})
	if !strings.Contains(rec.Body.String(), "Неверный логин или код") {
		t.Fatalf("wrong code in stub: %s", rec.Body.String())
	}

	rec = post(h.ServePassword, PasswordPath, url.Values{"username": {"ivanov_ii"}, "current": {"x"}, "password": {"NewPass123"}, "confirm": {"NewPass123"}})
	if !strings.Contains(rec.Body.String(), "Тестовый режим") || len(pw.sets) != 0 {
		t.Fatalf("password stub: %s", rec.Body.String())
	}
}
