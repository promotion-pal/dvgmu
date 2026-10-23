package session

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
)

// Signer — Ed25519-ключ подписи access-токенов. Публичная часть уходит в
// JWKS, по ней токен проверяет кто угодно (api fesmu и др.) без общего секрета.
type Signer struct {
	priv ed25519.PrivateKey
	kid  string
}

// LoadSigner читает PKCS8 PEM (openssl genpkey -algorithm ed25519) — как
// есть или одной строкой с "\n" вместо переводов строк (так удобнее в .env).
// Пустая строка — ключ генерируется (generated=true): годится для
// разработки, но после рестарта выданные токены перестают проверяться.
func LoadSigner(keyPEM string) (signer *Signer, generated bool, err error) {
	keyPEM = strings.TrimSpace(strings.ReplaceAll(keyPEM, `\n`, "\n"))
	if keyPEM == "" {
		_, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			return nil, false, err
		}
		return newSigner(priv), true, nil
	}

	block, _ := pem.Decode([]byte(keyPEM))
	if block == nil {
		return nil, false, errors.New("signing key: not a PEM block")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, false, fmt.Errorf("signing key: %w", err)
	}
	priv, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		return nil, false, fmt.Errorf("signing key: want Ed25519, got %T", parsed)
	}
	return newSigner(priv), false, nil
}

func newSigner(priv ed25519.PrivateKey) *Signer {
	sum := sha256.Sum256(priv.Public().(ed25519.PublicKey))
	return &Signer{priv: priv, kid: hex.EncodeToString(sum[:8])}
}

func (s *Signer) Public() ed25519.PublicKey { return s.priv.Public().(ed25519.PublicKey) }

// JWKS — документ /.well-known/jwks.json (RFC 8037, OKP/Ed25519).
func (s *Signer) JWKS() []byte {
	doc, _ := json.Marshal(map[string]any{
		"keys": []map[string]string{{
			"kty": "OKP",
			"crv": "Ed25519",
			"alg": "EdDSA",
			"use": "sig",
			"kid": s.kid,
			"x":   base64.RawURLEncoding.EncodeToString(s.Public()),
		}},
	})
	return doc
}
