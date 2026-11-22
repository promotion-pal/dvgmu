package testdb

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"dvgmu/auth/internal/auth"
	"dvgmu/auth/internal/storage"
	"golang.org/x/crypto/bcrypt"
)

type Provider struct {
	identities *storage.IdentityStore
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func New(identities *storage.IdentityStore) *Provider {
	return &Provider{identities: identities}
}

func (p *Provider) RegisterRoutes(mux *http.ServeMux, complete auth.CompleteLogin) {
	mux.HandleFunc("POST /v1/auth/token", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
		var input loginRequest
		decoder := json.NewDecoder(r.Body)
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&input); err != nil || strings.TrimSpace(input.Email) == "" || input.Password == "" {
			http.Error(w, "email and password are required", http.StatusBadRequest)
			return
		}
		identity, err := p.identities.ByEmail(r.Context(), input.Email)
		if errors.Is(err, storage.ErrIdentityNotFound) || err == nil && bcrypt.CompareHashAndPassword([]byte(identity.PasswordHash), []byte(input.Password)) != nil {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}
		if err != nil {
			slog.Error("test identity lookup failed", slog.String("error", err.Error()))
			http.Error(w, "identity provider unavailable", http.StatusServiceUnavailable)
			return
		}
		complete(w, r, auth.ExternalIdentity{Issuer: "test-db", Subject: identity.Subject})
	})
}

type Mapper struct {
	identities *storage.IdentityStore
}

func NewMapper(identities *storage.IdentityStore) *Mapper {
	return &Mapper{identities: identities}
}

func (m *Mapper) ResolveUserID(ctx context.Context, identity auth.ExternalIdentity) (int64, error) {
	if identity.Issuer != "test-db" {
		return 0, errors.New("identity issuer is not supported by test mapper")
	}
	linked, err := m.identities.BySubject(ctx, identity.Subject)
	if err != nil {
		return 0, err
	}
	return linked.MDMUserID, nil
}
