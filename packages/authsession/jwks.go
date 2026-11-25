package authsession

import (
	"context"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// refetchEvery — not more often than this does an unknown kid trigger a new
// JWKS download (a key rotation in auth, or a junk token).
const refetchEvery = 30 * time.Second

// JWKS — auth's public keys (/.well-known/jwks.json), cached. An unknown
// kid re-downloads them, so a rotated key in auth needs no restart here.
type JWKS struct {
	url        string
	httpClient *http.Client

	mu        sync.Mutex
	keys      map[string]ed25519.PublicKey
	fetchedAt time.Time
}

func NewJWKS(url string) *JWKS {
	return &JWKS{url: url, httpClient: &http.Client{Timeout: 5 * time.Second}}
}

func (j *JWKS) Key(ctx context.Context, kid string) (ed25519.PublicKey, error) {
	j.mu.Lock()
	defer j.mu.Unlock()

	if key, ok := j.keys[kid]; ok {
		return key, nil
	}
	if time.Since(j.fetchedAt) < refetchEvery {
		return nil, fmt.Errorf("unknown signing key %q", kid)
	}
	if err := j.fetch(ctx); err != nil {
		return nil, err
	}
	if key, ok := j.keys[kid]; ok {
		return key, nil
	}
	return nil, fmt.Errorf("unknown signing key %q", kid)
}

func (j *JWKS) fetch(ctx context.Context) error {
	j.fetchedAt = time.Now()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, j.url, nil)
	if err != nil {
		return err
	}
	resp, err := j.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("jwks unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("jwks: unexpected status %d", resp.StatusCode)
	}

	var doc struct {
		Keys []struct {
			Kty string `json:"kty"`
			Crv string `json:"crv"`
			Kid string `json:"kid"`
			X   string `json:"x"`
		} `json:"keys"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return fmt.Errorf("jwks: %w", err)
	}

	keys := make(map[string]ed25519.PublicKey, len(doc.Keys))
	for _, k := range doc.Keys {
		if k.Kty != "OKP" || k.Crv != "Ed25519" {
			continue
		}
		x, err := base64.RawURLEncoding.DecodeString(k.X)
		if err != nil || len(x) != ed25519.PublicKeySize {
			continue
		}
		keys[k.Kid] = ed25519.PublicKey(x)
	}
	if len(keys) == 0 {
		return errors.New("jwks: no Ed25519 keys")
	}
	j.keys = keys
	return nil
}
