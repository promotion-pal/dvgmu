package session

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/mdm"
	"dvgmu/auth/internal/utils"
)

const (
	guidLinked   = "11111111-1111-4111-8111-111111111111"
	guidUnlinked = "22222222-2222-4222-8222-222222222222"
	uuidIvanov   = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
)

type fakeDir struct {
	mu    sync.Mutex
	users map[string]*mdm.User // по objectGUID
}

func (d *fakeDir) ByADObjectID(_ context.Context, guid string) (*mdm.User, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	if u, ok := d.users[guid]; ok {
		cp := *u
		return &cp, nil
	}
	return nil, mdm.ErrNotFound
}

func (d *fakeDir) ByUUID(_ context.Context, id string) (*mdm.User, error) {
	d.mu.Lock()
	defer d.mu.Unlock()
	for _, u := range d.users {
		if u.UUID == id {
			cp := *u
			return &cp, nil
		}
	}
	return nil, mdm.ErrNotFound
}

type fakeStore struct {
	mu   sync.Mutex
	rows []*models.RefreshToken
}

func (s *fakeStore) RefreshTokenCreate(_ context.Context, t *models.RefreshToken) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rows = append(s.rows, t)
	return nil
}

func (s *fakeStore) RefreshTokenByHash(_ context.Context, hash []byte) (*models.RefreshToken, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range s.rows {
		if bytes.Equal(r.TokenHash, hash) {
			cp := *r
			return &cp, nil
		}
	}
	return nil, utils.ErrInvalidToken
}

func (s *fakeStore) RefreshTokenRotate(_ context.Context, oldID string, next *models.RefreshToken) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range s.rows {
		if r.ID == oldID && r.RevokedAt == nil {
			now := time.Now()
			r.RevokedAt = &now
			s.rows = append(s.rows, next)
			return nil
		}
	}
	return utils.ErrInvalidToken
}

func (s *fakeStore) RefreshTokenRevokeFamily(_ context.Context, familyID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for _, r := range s.rows {
		if r.FamilyID == familyID && r.RevokedAt == nil {
			r.RevokedAt = &now
		}
	}
	return nil
}

type fakeSSO struct{ guid string }

func (f fakeSSO) ObjectGUID(*http.Request) (string, bool) { return f.guid, f.guid != "" }
func (f fakeSSO) Clear(w http.ResponseWriter, _ *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: "dvgmu_session", MaxAge: -1})
}

var testCfg = config.SessionConfig{
	Issuer:        "auth-service",
	Audience:      "fesmu",
	AccessTTL:     15 * time.Minute,
	RefreshTTL:    720 * time.Hour,
	CookieDomain:  ".fesmu.ru",
	AccessCookie:  "fesmu_at",
	RefreshCookie: "fesmu_rt",
}

func newTestManager(t *testing.T, sso fakeSSO) (*Manager, *fakeDir, *fakeStore) {
	t.Helper()
	signer, _, err := LoadSigner("")
	if err != nil {
		t.Fatal(err)
	}
	dir := &fakeDir{users: map[string]*mdm.User{
		guidLinked: {UUID: uuidIvanov, Username: "ivanov_ii", Active: true, Roles: []string{"TEACHER"}, Permissions: []string{"certificate.view"}},
	}}
	store := &fakeStore{}
	return NewManager(testCfg, signer, dir, store, sso, slog.New(slog.NewTextHandler(io.Discard, nil))), dir, store
}

// login — Start + cookie, которые браузер унёс бы с собой.
func login(t *testing.T, m *Manager, guid string) (map[string]*http.Cookie, error) {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "https://auth.fesmu.ru/login", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	err := m.Start(context.Background(), rec, req, guid)
	return cookies(rec), err
}

func cookies(rec *httptest.ResponseRecorder) map[string]*http.Cookie {
	out := map[string]*http.Cookie{}
	for _, c := range rec.Result().Cookies() {
		out[c.Name] = c
	}
	return out
}

func call(m *Manager, h http.HandlerFunc, method string, cs ...*http.Cookie) (*httptest.ResponseRecorder, map[string]any) {
	req := httptest.NewRequest(method, "https://auth.fesmu.ru"+MePath, nil)
	for _, c := range cs {
		if c != nil {
			req.AddCookie(&http.Cookie{Name: c.Name, Value: c.Value})
		}
	}
	rec := httptest.NewRecorder()
	h(rec, req)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec, body
}

func TestStart_LinkedIssuesCookies(t *testing.T) {
	m, _, store := newTestManager(t, fakeSSO{})

	cs, err := login(t, m, strings.ToUpper(guidLinked)) // GUID из AD FS бывает в любом регистре
	if err != nil {
		t.Fatal(err)
	}
	at, rt := cs["fesmu_at"], cs["fesmu_rt"]
	if at == nil || rt == nil {
		t.Fatalf("cookies = %v", cs)
	}
	if !at.HttpOnly || !at.Secure || at.SameSite != http.SameSiteStrictMode || at.Domain != "fesmu.ru" {
		t.Fatalf("access cookie attrs: %+v", at)
	}
	if !rt.HttpOnly || rt.Domain != "" || rt.Path != "/api/v1/auth" {
		t.Fatalf("refresh cookie must be host-only on auth, path /api/v1/auth: %+v", rt)
	}

	claims, err := m.Verify(at.Value)
	if err != nil {
		t.Fatal(err)
	}
	if claims.Subject != uuidIvanov || claims.Username != "ivanov_ii" || !slices.Equal(claims.Roles, []string{"TEACHER"}) ||
		!slices.Equal(claims.Perms, []string{"certificate.view"}) {
		t.Fatalf("claims = %+v", claims)
	}
	if exp := time.Until(claims.ExpiresAt.Time); exp > 15*time.Minute || exp < 14*time.Minute {
		t.Fatalf("access ttl = %v", exp)
	}

	if len(store.rows) != 1 || bytes.Equal(store.rows[0].TokenHash, []byte(rt.Value)) {
		t.Fatalf("refresh must be stored hashed: %+v", store.rows)
	}
}

func TestStart_NotLinked(t *testing.T) {
	m, dir, _ := newTestManager(t, fakeSSO{})

	cs, err := login(t, m, guidUnlinked)
	if !errors.Is(err, utils.ErrNotLinked) || len(cs) != 0 {
		t.Fatalf("err = %v, cookies = %v", err, cs)
	}

	dir.users[guidLinked].Active = false
	if _, err := login(t, m, guidLinked); !errors.Is(err, utils.ErrNotLinked) {
		t.Fatalf("inactive user: err = %v", err)
	}
}

func TestMe(t *testing.T) {
	m, _, _ := newTestManager(t, fakeSSO{})
	cs, _ := login(t, m, guidLinked)

	rec, body := call(m, m.ServeMe, http.MethodGet, cs["fesmu_at"])
	if rec.Code != 200 || body["uuid"] != uuidIvanov || body["username"] != "ivanov_ii" {
		t.Fatalf("me: %d %v", rec.Code, body)
	}

	rec, body = call(m, m.ServeMe, http.MethodGet, cs["fesmu_rt"])
	if rec.Code != 401 || body["error"] != "expired" {
		t.Fatalf("only refresh: %d %v", rec.Code, body)
	}

	rec, body = call(m, m.ServeMe, http.MethodGet)
	if rec.Code != 401 || body["error"] != "unauthenticated" {
		t.Fatalf("no cookies: %d %v", rec.Code, body)
	}
}

func TestMe_SSOWithoutFesmuTokens(t *testing.T) {
	notLinked, _, _ := newTestManager(t, fakeSSO{guid: guidUnlinked})
	rec, body := call(notLinked, notLinked.ServeMe, http.MethodGet)
	if rec.Code != 403 || body["error"] != "not_linked" {
		t.Fatalf("unlinked SSO: %d %v", rec.Code, body)
	}

	// Связан, но токены fesmu потеряны — не not_linked, а unauthenticated:
	// /login выдаст их по SSO-сессии без пароля.
	linked, _, _ := newTestManager(t, fakeSSO{guid: guidLinked})
	rec, body = call(linked, linked.ServeMe, http.MethodGet)
	if rec.Code != 401 || body["error"] != "unauthenticated" {
		t.Fatalf("linked SSO: %d %v", rec.Code, body)
	}
}

func TestRefresh_RotatesAndPicksFreshRoles(t *testing.T) {
	m, dir, _ := newTestManager(t, fakeSSO{})
	cs, _ := login(t, m, guidLinked)

	dir.users[guidLinked].Roles = []string{"TEACHER", "ADMIN"}
	dir.users[guidLinked].Permissions = []string{"certificate.issue"}

	rec, body := call(m, m.ServeRefresh, http.MethodPost, cs["fesmu_rt"])
	if rec.Code != 200 {
		t.Fatalf("refresh: %d %v", rec.Code, body)
	}
	next := cookies(rec)
	if next["fesmu_rt"] == nil || next["fesmu_rt"].Value == cs["fesmu_rt"].Value {
		t.Fatal("refresh token must rotate")
	}
	claims, err := m.Verify(next["fesmu_at"].Value)
	if err != nil || !slices.Equal(claims.Roles, []string{"TEACHER", "ADMIN"}) || !slices.Equal(claims.Perms, []string{"certificate.issue"}) {
		t.Fatalf("roles after refresh = %v (%v)", claims, err)
	}

	if rec, _ := call(m, m.ServeRefresh, http.MethodGet, next["fesmu_rt"]); rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("GET refresh = %d", rec.Code)
	}
}

func TestRefresh_ReuseRevokesFamily(t *testing.T) {
	m, _, _ := newTestManager(t, fakeSSO{})
	cs, _ := login(t, m, guidLinked)

	rec, _ := call(m, m.ServeRefresh, http.MethodPost, cs["fesmu_rt"])
	next := cookies(rec)["fesmu_rt"]

	// Старый (уже отозванный) токен предъявлен повторно.
	rec, body := call(m, m.ServeRefresh, http.MethodPost, cs["fesmu_rt"])
	if rec.Code != 401 || body["error"] != "unauthenticated" {
		t.Fatalf("reuse: %d %v", rec.Code, body)
	}
	// ...и законный новый тоже больше не работает: семья отозвана.
	if rec, _ := call(m, m.ServeRefresh, http.MethodPost, next); rec.Code != 401 {
		t.Fatalf("after reuse the new token must be revoked too, got %d", rec.Code)
	}
}

func TestRefresh_UnlinkedInMDM(t *testing.T) {
	m, dir, _ := newTestManager(t, fakeSSO{})
	cs, _ := login(t, m, guidLinked)

	delete(dir.users, guidLinked)
	rec, body := call(m, m.ServeRefresh, http.MethodPost, cs["fesmu_rt"])
	if rec.Code != 401 || body["error"] != "not_linked" {
		t.Fatalf("refresh after unlink: %d %v", rec.Code, body)
	}
}

func TestRefresh_Expired(t *testing.T) {
	m, _, _ := newTestManager(t, fakeSSO{})
	cs, _ := login(t, m, guidLinked)

	m.now = func() time.Time { return time.Now().Add(31 * 24 * time.Hour) }
	if rec, _ := call(m, m.ServeRefresh, http.MethodPost, cs["fesmu_rt"]); rec.Code != 401 {
		t.Fatalf("expired refresh = %d", rec.Code)
	}
}

func TestLogout(t *testing.T) {
	m, _, store := newTestManager(t, fakeSSO{guid: guidLinked})
	cs, _ := login(t, m, guidLinked)

	rec, _ := call(m, m.ServeLogout, http.MethodPost, cs["fesmu_at"], cs["fesmu_rt"])
	if rec.Code != http.StatusNoContent {
		t.Fatalf("logout = %d", rec.Code)
	}
	cleared := cookies(rec)
	for _, name := range []string{"fesmu_at", "fesmu_rt", "dvgmu_session"} {
		if c := cleared[name]; c == nil || c.MaxAge >= 0 {
			t.Fatalf("cookie %s not cleared: %+v", name, c)
		}
	}
	if store.rows[0].RevokedAt == nil {
		t.Fatal("refresh token not revoked")
	}
}

func TestVerify_Rejects(t *testing.T) {
	m, _, _ := newTestManager(t, fakeSSO{})
	cs, _ := login(t, m, guidLinked)
	at := cs["fesmu_at"].Value

	other, _, _ := newTestManager(t, fakeSSO{}) // другой ключ
	if _, err := other.Verify(at); err == nil {
		t.Fatal("token signed by another key accepted")
	}

	wrongAud := *m
	wrongAud.cfg.Audience = "someone-else"
	if _, err := wrongAud.Verify(at); err == nil {
		t.Fatal("wrong audience accepted")
	}

	m.now = func() time.Time { return time.Now().Add(16 * time.Minute) }
	if _, err := m.Verify(at); err == nil {
		t.Fatal("expired access token accepted")
	}

	parts := strings.Split(at, ".")
	payload, _ := base64.RawURLEncoding.DecodeString(parts[1])
	forged := strings.Replace(string(payload), `"TEACHER"`, `"ADMIN"`, 1)
	parts[1] = base64.RawURLEncoding.EncodeToString([]byte(forged))
	m.now = time.Now
	if _, err := m.Verify(strings.Join(parts, ".")); err == nil {
		t.Fatal("forged payload accepted")
	}
}

func TestJWKS(t *testing.T) {
	m, _, _ := newTestManager(t, fakeSSO{})
	rec := httptest.NewRecorder()
	m.ServeJWKS(rec, httptest.NewRequest(http.MethodGet, JWKSPath, nil))

	var doc struct {
		Keys []map[string]string `json:"keys"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &doc); err != nil || len(doc.Keys) != 1 {
		t.Fatalf("jwks = %s", rec.Body.String())
	}
	x, _ := base64.RawURLEncoding.DecodeString(doc.Keys[0]["x"])
	if doc.Keys[0]["crv"] != "Ed25519" || !bytes.Equal(x, m.signer.Public()) {
		t.Fatalf("jwks key mismatch: %v", doc.Keys[0])
	}
}

func TestLoadSigner_PEMForms(t *testing.T) {
	const pemKey = "-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIOKIOnlLNSbYTQwG9wh4PsIOwH+tNEBDQOcJwDm9EuXN\n-----END PRIVATE KEY-----\n"
	multi, gen, err := LoadSigner(pemKey)
	if err != nil || gen {
		t.Fatalf("multi-line: %v gen=%v", err, gen)
	}
	single, _, err := LoadSigner(strings.ReplaceAll(pemKey, "\n", `\n`))
	if err != nil || !bytes.Equal(single.Public(), multi.Public()) {
		t.Fatalf("single-line with \\n: %v", err)
	}
	if _, _, err := LoadSigner("not a key"); err == nil {
		t.Fatal("garbage accepted")
	}
}
