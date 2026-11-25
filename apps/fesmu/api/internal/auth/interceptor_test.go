package auth

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fesmu/contract/fesmu/service/v2/servicev2connect"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"fesmu/authsession"
	"github.com/golang-jwt/jwt/v5"
)

// fakeAuth — auth's JWKS endpoint with the keys currently published.
type fakeAuth struct {
	srv  *httptest.Server
	keys atomic.Value // map[string]ed25519.PublicKey
}

func newFakeAuth(t *testing.T) *fakeAuth {
	t.Helper()
	f := &fakeAuth{}
	f.keys.Store(map[string]ed25519.PublicKey{})
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		var keys []map[string]string
		for kid, pub := range f.keys.Load().(map[string]ed25519.PublicKey) {
			keys = append(keys, map[string]string{
				"kty": "OKP", "crv": "Ed25519", "kid": kid,
				"x": base64.RawURLEncoding.EncodeToString(pub),
			})
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": keys})
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeAuth) publish(kid string) ed25519.PrivateKey {
	pub, priv, _ := ed25519.GenerateKey(rand.Reader)
	keys := map[string]ed25519.PublicKey{}
	for k, v := range f.keys.Load().(map[string]ed25519.PublicKey) {
		keys[k] = v
	}
	keys[kid] = pub
	f.keys.Store(keys)
	return priv
}

type tokenOpts struct {
	kid      string
	aud      string
	roles    []string
	expireIn time.Duration
}

func sign(t *testing.T, priv ed25519.PrivateKey, o tokenOpts) string {
	t.Helper()
	if o.aud == "" {
		o.aud = "fesmu"
	}
	if o.expireIn == 0 {
		o.expireIn = 15 * time.Minute
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodEdDSA, struct {
		Username string   `json:"username"`
		Roles    []string `json:"roles"`
		jwt.RegisteredClaims
	}{
		Username: "ivanov_ii",
		Roles:    o.roles,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			Issuer:    "auth-service",
			Audience:  jwt.ClaimStrings{o.aud},
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(o.expireIn)),
		},
	})
	tok.Header["kid"] = o.kid
	raw, err := tok.SignedString(priv)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func newInterceptor(f *fakeAuth) *Interceptor {
	return NewInterceptor(authsession.NewJWKS(f.srv.URL), "auth-service", "fesmu", "fesmu_at")
}

func TestVerify_OK(t *testing.T) {
	f := newFakeAuth(t)
	priv := f.publish("k1")

	user, err := newInterceptor(f).Verify(t.Context(), sign(t, priv, tokenOpts{kid: "k1", roles: []string{"TEACHER"}}))
	if err != nil {
		t.Fatal(err)
	}
	if user.UUID != "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" || user.Username != "ivanov_ii" || !user.HasRole(RoleTeacher) || user.HasRole(RoleStudent) {
		t.Fatalf("user = %+v", user)
	}
}

func TestVerify_Rejects(t *testing.T) {
	f := newFakeAuth(t)
	priv := f.publish("k1")
	_, stranger, _ := ed25519.GenerateKey(rand.Reader)
	i := newInterceptor(f)

	cases := map[string]string{
		"foreign key":    sign(t, stranger, tokenOpts{kid: "k1"}),
		"wrong audience": sign(t, priv, tokenOpts{kid: "k1", aud: "other-app"}),
		"expired":        sign(t, priv, tokenOpts{kid: "k1", expireIn: -time.Minute}),
		"unknown kid":    sign(t, priv, tokenOpts{kid: "nope"}),
		"garbage":        "not.a.token",
	}
	good := sign(t, priv, tokenOpts{kid: "k1", roles: []string{"STUDENT"}})
	parts := strings.Split(good, ".")
	payload, _ := base64.RawURLEncoding.DecodeString(parts[1])
	parts[1] = base64.RawURLEncoding.EncodeToString([]byte(strings.Replace(string(payload), "STUDENT", "ADMIN", 1)))
	cases["forged roles"] = strings.Join(parts, ".")

	for name, raw := range cases {
		if _, err := i.Verify(t.Context(), raw); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestHTTPMiddleware_RequireRole(t *testing.T) {
	f := newFakeAuth(t)
	priv := f.publish("k1")
	i := newInterceptor(f)

	const rolesSet = "/contract.service.UserService/UserRolesSet"
	h := i.HTTPMiddleware(RequireRoleHTTP(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}), []string{rolesSet}, RoleAdmin))

	call := func(path, token string) int {
		req := httptest.NewRequest(http.MethodPost, path, nil)
		if token != "" {
			req.AddCookie(&http.Cookie{Name: "fesmu_at", Value: token})
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec.Code
	}
	teacher := sign(t, priv, tokenOpts{kid: "k1", roles: []string{"TEACHER"}})
	admin := sign(t, priv, tokenOpts{kid: "k1", roles: []string{"ADMIN"}})

	if c := call("/contract.service.UserService/UserFetch", ""); c != http.StatusUnauthorized {
		t.Fatalf("no cookie: %d", c)
	}
	if c := call("/contract.service.UserService/UserFetch", teacher); c != http.StatusOK {
		t.Fatalf("teacher fetch: %d", c)
	}
	if c := call(rolesSet, teacher); c != http.StatusForbidden {
		t.Fatalf("teacher sets roles: %d", c)
	}
	if c := call(rolesSet, admin); c != http.StatusOK {
		t.Fatalf("admin sets roles: %d", c)
	}
}

func TestAuthorize_ByServiceRoles(t *testing.T) {
	i := NewInterceptor(nil, "auth-service", "fesmu", "fesmu_at")
	i.Access = map[string][]string{
		"contract.service.v1.TestService": {RoleTeacher},
		"contract.service.v1.UserService": nil,
	}
	as := func(roles ...string) context.Context {
		return context.WithValue(context.Background(), userKey, &User{UUID: "u", Roles: roles})
	}
	cases := []struct {
		name      string
		ctx       context.Context
		procedure string
		allowed   bool
	}{
		{"teacher → tests", as(RoleTeacher), "/contract.service.v1.TestService/TestFetch", true},
		{"student → tests", as(RoleStudent), "/contract.service.v1.TestService/TestFetch", false},
		{"no roles → tests", as(), "/contract.service.v1.TestService/TestFetch", false},
		{"admin → tests", as(RoleAdmin), "/contract.service.v1.TestService/TestFetch", true},
		{"no roles → UserMe", as(), "/contract.service.v1.UserService/UserMe", true},
		{"staff → unlisted service", as(RoleStaff), "/contract.service.v1.NewService/Do", false},
		{"admin → unlisted service", as(RoleAdmin), "/contract.service.v1.NewService/Do", true},
	}
	for _, tc := range cases {
		err := i.authorize(tc.ctx, tc.procedure)
		if (err == nil) != tc.allowed {
			t.Errorf("%s: err = %v, allowed want %v", tc.name, err, tc.allowed)
		}
	}
}

func TestAuthorize_BySections(t *testing.T) {
	i := NewInterceptor(nil, "auth-service", "fesmu", "fesmu_at")
	i.Sections = map[string][]Section{
		"contract.service.v1.InventoryService": {SectionInventory},
	}
	as := func(roles []string, perms ...string) context.Context {
		return context.WithValue(context.Background(), userKey, &User{UUID: "u", Roles: roles, Permissions: perms})
	}
	const (
		read  = "/contract.service.v1.InventoryService/InventoryFetch"
		byID  = "/contract.service.v1.InventoryService/InventoryByID"
		write = "/contract.service.v1.InventoryService/InventoryUpdate"
	)
	fetch, post := Perm(SectionInventory, ActionFetch), Perm(SectionInventory, ActionPost)
	cases := []struct {
		name      string
		ctx       context.Context
		procedure string
		allowed   bool
	}{
		{"staff without access → read", as([]string{RoleStaff}), read, false},
		{"fetch → read", as(nil, fetch), read, true},
		{"fetch → by id", as(nil, fetch), byID, true},
		{"fetch → write", as(nil, fetch), write, false},
		{"post → read", as(nil, post), read, true},
		{"post → write", as(nil, post), write, true},
		{"other section → read", as(nil, Perm(SectionTickets, ActionPost)), read, false},
		{"admin → write", as([]string{RoleAdmin}), write, true},
	}
	for _, tc := range cases {
		err := i.authorize(tc.ctx, tc.procedure)
		if (err == nil) != tc.allowed {
			t.Errorf("%s: err = %v, allowed want %v", tc.name, err, tc.allowed)
		}
	}
}

// Сервис, который делят несколько разделов (закупки — по разделу на роль):
// пускает право на любой из них; чтения не по правилу имён — из readProcedures.
func TestAuthorize_AnyOfSections(t *testing.T) {
	i := NewInterceptor(nil, "auth-service", "fesmu", "fesmu_at")
	i.Sections = map[string][]Section{servicev2connect.PurchaseServiceName: PurchaseSections}
	as := func(roles []string, perms ...string) context.Context {
		return context.WithValue(context.Background(), userKey, &User{UUID: "u", Roles: roles, Permissions: perms})
	}
	const write = "/contract.service.v2.PurchaseService/PurchaseRequestCreate"
	overview := servicev2connect.PurchaseServicePurchaseOverviewProcedure
	cases := []struct {
		name      string
		ctx       context.Context
		procedure string
		allowed   bool
	}{
		{"no rights → overview", as(nil), overview, false},
		{"economist fetch → overview", as(nil, Perm(SectionPurchaseEconomist, ActionFetch)), overview, true},
		{"request post → overview", as(nil, Perm(SectionPurchaseRequest, ActionPost)), overview, true},
		{"commission fetch → write", as(nil, Perm(SectionPurchaseCommission, ActionFetch)), write, false},
		{"head post → write", as(nil, Perm(SectionPurchaseHead, ActionPost)), write, true},
		{"other section → overview", as(nil, Perm(SectionSchedule, ActionPost)), overview, false},
		{"admin → write", as([]string{RoleAdmin}), write, true},
	}
	for _, tc := range cases {
		err := i.authorize(tc.ctx, tc.procedure)
		if (err == nil) != tc.allowed {
			t.Errorf("%s: err = %v, allowed want %v", tc.name, err, tc.allowed)
		}
	}
}

func TestMaybeAuthenticate(t *testing.T) {
	f := newFakeAuth(t)
	priv := f.publish("k1")
	i := newInterceptor(f)

	header := func(token string) http.Header {
		h := http.Header{}
		if token != "" {
			h.Set("Cookie", "fesmu_at="+token)
		}
		return h
	}
	cases := []struct {
		name   string
		token  string
		signed bool
	}{
		{"no cookie", "", false},
		{"expired", sign(t, priv, tokenOpts{kid: "k1", expireIn: -time.Minute}), false},
		{"garbage", "not-a-token", false},
		{"valid", sign(t, priv, tokenOpts{kid: "k1", roles: []string{"TEACHER"}}), true},
	}
	for _, c := range cases {
		_, ok := UserFromContext(i.maybeAuthenticate(t.Context(), header(c.token)))
		if ok != c.signed {
			t.Errorf("%s: signed in = %v, want %v", c.name, ok, c.signed)
		}
	}
}
