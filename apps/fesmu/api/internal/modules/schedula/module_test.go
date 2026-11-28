package schedula

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"dvgmu/api/internal/auth"
	"fesmu/contract/schedula/service/serviceconnect"
)

func TestMountForwardsOnlyVerifiedScheduleIdentity(t *testing.T) {
	const uuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	const internalToken = "schedula-test-token"
	const public = serviceconnect.SchedulaServicePublicScheduleFetchProcedure
	const private = serviceconnect.SchedulaServiceScheduleFetchProcedure

	key, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	token := jwt.NewWithClaims(jwt.SigningMethodEdDSA, jwt.RegisteredClaims{
		Subject: uuid, Issuer: "auth-service", Audience: jwt.ClaimStrings{"fesmu"},
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Minute)),
	})
	token.Header["kid"] = "test"
	session, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	jwks := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{
			{"kid": "test", "kty": "OKP", "crv": "Ed25519", "x": base64.RawURLEncoding.EncodeToString(key)},
		}})
	}))
	defer jwks.Close()

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Test-Identity", r.Header.Get("X-Schedula-User"))
		if r.Header.Get("Authorization") != "Bearer "+internalToken || r.Header.Get("Cookie") != "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer upstream.Close()

	mux := http.NewServeMux()
	New(upstream.URL, internalToken, auth.NewInterceptor(auth.NewJWKS(jwks.URL), "auth-service", "fesmu", "fesmu_at")).Mount(mux)
	for _, tc := range []struct {
		name     string
		path     string
		session  string
		status   int
		identity string
	}{
		{"public, including with an active session", public, session, http.StatusNoContent, ""},
		{"private rejects missing session", private, "", http.StatusUnauthorized, ""},
		{"private rejects invalid session", private, "invalid", http.StatusUnauthorized, ""},
		{"private uses verified session identity", private, session, http.StatusNoContent, uuid},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, tc.path, nil)
			r.Header.Set("X-Schedula-User", "unverified-user")
			r.Header.Set("Authorization", "Bearer unverified-token")
			if tc.session != "" {
				r.AddCookie(&http.Cookie{Name: "fesmu_at", Value: tc.session})
			}
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, r)
			if w.Code != tc.status || w.Header().Get("Test-Identity") != tc.identity {
				t.Fatalf("status=%d identity=%q, want %d and %q", w.Code, w.Header().Get("Test-Identity"), tc.status, tc.identity)
			}
			if tc.identity != "" && w.Header().Get("Cache-Control") != "private, no-store" {
				t.Fatalf("private response cache control: %q", w.Header().Get("Cache-Control"))
			}
		})
	}
}
