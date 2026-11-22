package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"fesmu/contract/auth/token"
)

type Config struct {
	Port      string
	JWTSecret string
	JWTIssuer string
	TokenTTL  time.Duration
}

type ExternalIdentity struct {
	Issuer  string
	Subject string
}

type IdentityMapper interface {
	ResolveUserID(context.Context, ExternalIdentity) (int64, error)
}

type CompleteLogin func(http.ResponseWriter, *http.Request, ExternalIdentity)

type IdentityProvider interface {
	RegisterRoutes(*http.ServeMux, CompleteLogin)
}

type Service struct {
	Port     string
	config   Config
	provider IdentityProvider
	mapper   IdentityMapper
	users    UserClient
	log      *slog.Logger
}

type UserClient interface {
	UserFetchByID(context.Context, int64) (*User, error)
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	UserID      string `json:"user_id"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int64  `json:"expires_in"`
}

type User struct {
	ID          int64
	UUID        string
	Email       string
	Active      bool
	Roles       []string
	Permissions []string
}

func New(config Config, provider IdentityProvider, mapper IdentityMapper, users UserClient, log *slog.Logger) (*Service, error) {
	if len(config.JWTSecret) < 32 {
		return nil, errors.New("JWT_SECRET must contain at least 32 bytes")
	}
	if config.JWTIssuer == "" || config.TokenTTL <= 0 || provider == nil || mapper == nil || users == nil {
		return nil, errors.New("JWT issuer, token lifetime, identity provider, identity mapper and MDM client are required")
	}
	return &Service{Port: config.Port, config: config, provider: provider, mapper: mapper, users: users, log: log}, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	s.provider.RegisterRoutes(mux, s.completeLogin)
	return mux
}

func (s *Service) completeLogin(w http.ResponseWriter, r *http.Request, external ExternalIdentity) {
	userID, err := s.mapper.ResolveUserID(r.Context(), external)
	if err != nil {
		http.Error(w, "identity could not be linked to a local user", http.StatusUnauthorized)
		return
	}
	user, err := s.users.UserFetchByID(r.Context(), userID)
	if err != nil {
		s.log.Error("could not fetch MDM user", slog.Int64("user_id", userID), slog.String("error", err.Error()))
		http.Error(w, "could not load user profile", http.StatusBadGateway)
		return
	}
	if !user.Active {
		http.Error(w, "user account is inactive", http.StatusForbidden)
		return
	}
	now := time.Now()
	claims := token.Claims{
		Issuer:      s.config.JWTIssuer,
		Subject:     user.UUID,
		UserID:      user.ID,
		Roles:       user.Roles,
		Permissions: user.Permissions,
		IssuedAt:    now.Unix(),
		ExpiresAt:   now.Add(s.config.TokenTTL).Unix(),
	}
	accessToken, err := token.Sign(claims, []byte(s.config.JWTSecret))
	if err != nil {
		s.log.Error("could not issue access token", slog.String("error", err.Error()))
		http.Error(w, "could not issue access token", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(tokenResponse{AccessToken: accessToken, UserID: strconv.FormatInt(user.ID, 10), TokenType: "Bearer", ExpiresIn: int64(s.config.TokenTTL.Seconds())})
}
