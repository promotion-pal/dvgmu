package token_utils

import (
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
)

type Provider string

const (
	ProviderLocal Provider = "local"
	ProviderAD    Provider = "ad"
	ProviderSAML  Provider = "saml"
)

type Manager struct {
	secret []byte
	ttl    time.Duration
}

func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl}
}

func (m *Manager) TTL() time.Duration {
	return m.ttl
}

type Claims struct {
	jwt.RegisteredClaims
	Email     string   `json:"email"`
	FirstName string   `json:"first_name,omitempty"`
	LastName  string   `json:"last_name,omitempty"`
	UPN       string   `json:"upn,omitempty"`
	Provider  Provider `json:"provider"`
	MDMID     int64    `json:"mdm_id,omitempty"`
}

func (m *Manager) Issue(user *models.User, provider Provider) (string, time.Time, error) {
	now := time.Now()
	expiresAt := now.Add(m.ttl)

	subject := user.ExternalID
	if provider == ProviderLocal {
		subject = strconv.FormatInt(user.ID, 10)
	}

	claims := Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
		Email:     user.Email,
		FirstName: user.FirstName,
		LastName:  user.LastName,
		UPN:       user.UPN,
		Provider:  provider,
		MDMID:     user.MDMID,
	}

	signed, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, expiresAt, nil
}

func (m *Manager) Parse(raw string) (*Claims, error) {
	var claims Claims
	tok, err := jwt.ParseWithClaims(raw, &claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, utils.ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !tok.Valid {
		return nil, utils.ErrInvalidToken
	}
	return &claims, nil
}

func (c *Claims) LocalUserID() (int64, error) {
	id, err := strconv.ParseInt(c.Subject, 10, 64)
	if err != nil {
		return 0, utils.ErrInvalidToken
	}
	return id, nil
}
