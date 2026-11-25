package authsession

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// fakeAuth — auth's JWKS endpoint with the keys currently published.
type fakeAuth struct {
	srv     *httptest.Server
	keys    atomic.Value // map[string]ed25519.PublicKey
	fetches atomic.Int32
}

func newFakeAuth(t *testing.T) *fakeAuth {
	t.Helper()
	f := &fakeAuth{}
	f.keys.Store(map[string]ed25519.PublicKey{})
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		f.fetches.Add(1)
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
	tok := jwt.NewWithClaims(jwt.SigningMethodEdDSA, accessClaims{
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

func newVerifier(f *fakeAuth) *Verifier {
	return NewVerifier(NewJWKS(f.srv.URL), "auth-service", "fesmu", "fesmu_at")
}

// Key rotated in auth: an unknown kid re-reads JWKS, without a restart here.
func TestVerify_PicksUpRotatedKey(t *testing.T) {
	f := newFakeAuth(t)
	old := f.publish("k1")
	i := newVerifier(f)
	if _, err := i.Verify(t.Context(), sign(t, old, tokenOpts{kid: "k1"})); err != nil {
		t.Fatal(err)
	}

	next := f.publish("k2")
	i.keys.fetchedAt = time.Time{} // past the refetch pause
	if _, err := i.Verify(t.Context(), sign(t, next, tokenOpts{kid: "k2"})); err != nil {
		t.Fatalf("rotated key: %v", err)
	}

	// Junk kids don't hammer auth: one refetch per pause.
	before := f.fetches.Load()
	for range 5 {
		_, _ = i.Verify(t.Context(), sign(t, next, tokenOpts{kid: "junk"}))
	}
	if f.fetches.Load() != before {
		t.Fatalf("refetched %d times within the pause", f.fetches.Load()-before)
	}
}
