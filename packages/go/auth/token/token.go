package token

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const AccessTokenCookieName = "dvgmu_access_token"

var (
	ErrInvalidToken = errors.New("invalid access token")
	ErrExpiredToken = errors.New("access token expired")
)

type Claims struct {
	Issuer      string   `json:"iss"`
	Subject     string   `json:"sub"`
	UserID      int64    `json:"uid"`
	Roles       []string `json:"roles,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
	IssuedAt    int64    `json:"iat"`
	ExpiresAt   int64    `json:"exp"`
}

type header struct {
	Algorithm string `json:"alg"`
	Type      string `json:"typ"`
}

func Sign(claims Claims, secret []byte) (string, error) {
	if len(secret) < 32 {
		return "", errors.New("access token secret must contain at least 32 bytes")
	}
	if claims.UserID <= 0 || claims.Subject == "" || claims.Issuer == "" || claims.ExpiresAt <= claims.IssuedAt {
		return "", errors.New("invalid access token claims")
	}
	headerJSON, err := json.Marshal(header{Algorithm: "HS256", Type: "JWT"})
	if err != nil {
		return "", fmt.Errorf("marshal token header: %w", err)
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("marshal token claims: %w", err)
	}
	unsigned := base64.RawURLEncoding.EncodeToString(headerJSON) + "." + base64.RawURLEncoding.EncodeToString(claimsJSON)
	return unsigned + "." + signature(unsigned, secret), nil
}

func Verify(value string, secret []byte, issuer string, now time.Time) (Claims, error) {
	var claims Claims
	parts := strings.Split(value, ".")
	if len(parts) != 3 || len(secret) < 32 {
		return claims, ErrInvalidToken
	}
	unsigned := parts[0] + "." + parts[1]
	expected, err := base64.RawURLEncoding.DecodeString(signature(unsigned, secret))
	if err != nil {
		return claims, ErrInvalidToken
	}
	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(actual, expected) {
		return claims, ErrInvalidToken
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return claims, ErrInvalidToken
	}
	var tokenHeader header
	if json.Unmarshal(headerBytes, &tokenHeader) != nil || tokenHeader.Algorithm != "HS256" || tokenHeader.Type != "JWT" {
		return claims, ErrInvalidToken
	}
	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil || json.Unmarshal(claimsBytes, &claims) != nil {
		return Claims{}, ErrInvalidToken
	}
	if claims.Issuer != issuer || claims.UserID <= 0 || claims.Subject == "" || claims.ExpiresAt <= claims.IssuedAt {
		return Claims{}, ErrInvalidToken
	}
	if now.Unix() >= claims.ExpiresAt {
		return Claims{}, ErrExpiredToken
	}
	return claims, nil
}

func signature(value string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(value))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}
