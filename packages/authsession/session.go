package authsession

import (
	"context"
	"errors"
	"net/http"

	"github.com/golang-jwt/jwt/v5"
)

type User struct {
	UUID        string
	Username    string
	Roles       []string
	Permissions []string
}

type accessClaims struct {
	Username string   `json:"username"`
	Roles    []string `json:"roles"`
	Perms    []string `json:"perms"`
	jwt.RegisteredClaims
}

type Verifier struct {
	keys       *JWKS
	issuer     string
	audience   string
	cookieName string
}

func NewVerifier(keys *JWKS, issuer, audience, cookieName string) *Verifier {
	return &Verifier{keys: keys, issuer: issuer, audience: audience, cookieName: cookieName}
}

func (v *Verifier) FromHeader(ctx context.Context, header http.Header) (*User, error) {
	request := &http.Request{Header: header}
	cookie, err := request.Cookie(v.cookieName)
	if err != nil || cookie.Value == "" {
		return nil, errors.New("missing session cookie")
	}
	return v.Verify(ctx, cookie.Value)
}

// Verify checks EdDSA, signature, issuer, audience and expiry before using the subject.
func (v *Verifier) Verify(ctx context.Context, raw string) (*User, error) {
	claims := &accessClaims{}
	_, err := jwt.ParseWithClaims(raw, claims,
		func(token *jwt.Token) (any, error) {
			kid, _ := token.Header["kid"].(string)
			return v.keys.Key(ctx, kid)
		},
		jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}),
		jwt.WithIssuer(v.issuer),
		jwt.WithAudience(v.audience),
		jwt.WithExpirationRequired(),
	)
	if err != nil {
		return nil, errors.New("invalid or expired session")
	}
	if claims.Subject == "" {
		return nil, errors.New("access token has no subject")
	}
	return &User{UUID: claims.Subject, Username: claims.Username, Roles: claims.Roles, Permissions: claims.Perms}, nil
}
