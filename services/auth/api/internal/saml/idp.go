// Package saml — сторона SAML Identity Provider: auth выступает IdP для
// Yandex 360. Yandex редиректит пользователя на /saml/idp/sso с AuthnRequest,
// мы показываем свою форму логина, проверяем логин/пароль через AD FS
// (internal/adfs) и возвращаем Yandex подписанный SAML-Response.
package saml

import (
	"crypto"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	crewjamsaml "github.com/crewjam/saml"
	"github.com/crewjam/saml/logger"
	dsig "github.com/russellhaering/goxmldsig"

	"dvgmu/auth/internal/config"
)

const (
	MetadataPath = "/saml/idp/metadata"
	SSOPath      = "/saml/idp/sso"
	// LoginPath/LogoutPath — обычный (не-SAML) вход для прочих приложений
	// на *.dvgmu.promotion-pal.ru (см. standalone_login.go).
	LoginPath  = "/login"
	LogoutPath = "/logout"
)

// authnRequestTTL — сколько времени AuthnRequest от Yandex считается свежим.
// crewjam по умолчанию даёт 90 секунд (MaxIssueDelay), но мы перекладываем
// исходный запрос в скрытое поле формы логина: пользователю нужно успеть
// ввести логин/пароль. Значение также задаёт окно валидности исходящей
// ассерции (NotOnOrAfter).
const authnRequestTTL = 10 * time.Minute

// IdP оборачивает crewjamsaml.IdentityProvider и его HTTP-обработчики.
type IdP struct {
	provider *crewjamsaml.IdentityProvider
}

// NewIdP собирает Identity Provider. Возвращает (nil, nil), если ключ подписи
// не сконфигурирован — вызывающий код должен просто не поднимать /saml/idp/*.
func NewIdP(cfg config.IdPConfig, deps SessionDeps) (*IdP, error) {
	key, cert, err := parseKeyPair(cfg.CertPEM, cfg.KeyPEM)
	if err != nil {
		return nil, fmt.Errorf("idp cert/key: %w", err)
	}
	if key == nil {
		return nil, nil
	}

	base, err := url.Parse(strings.TrimRight(cfg.BaseURL, "/"))
	if err != nil || !base.IsAbs() {
		return nil, fmt.Errorf("AUTH_SAML_IDP_BASE_URL must be an absolute URL, got %q", cfg.BaseURL)
	}

	entityID := strings.TrimSpace(cfg.EntityID)
	if entityID == "" {
		entityID = base.String() + MetadataPath
	}
	metadataURL, err := url.Parse(entityID)
	if err != nil {
		return nil, fmt.Errorf("AUTH_SAML_IDP_ENTITY_ID must be a URL: %w", err)
	}

	ssoURL := *base
	ssoURL.Path = SSOPath

	// crewjam хранит окно свежести запроса/ассерции в пакетной переменной.
	if crewjamsaml.MaxIssueDelay < authnRequestTTL {
		crewjamsaml.MaxIssueDelay = authnRequestTTL
	}

	if len(cfg.SPACSURLs) == 0 {
		return nil, fmt.Errorf("AUTH_SAML_IDP_SP_ACS_URLS is empty")
	}

	provider := &crewjamsaml.IdentityProvider{
		Key:                     key,
		Certificate:             cert,
		Logger:                  logger.DefaultLogger,
		MetadataURL:             *metadataURL,
		SSOURL:                  ssoURL,
		ServiceProviderProvider: newStaticSPProvider(cfg.SPEntityID, cfg.SPACSURLs),
		SessionProvider:         newSessionProvider(cfg, ssoURL.String(), deps),
		SignatureMethod:         dsig.RSASHA256SignatureMethod,
	}

	return &IdP{provider: provider}, nil
}

func (i *IdP) ServeMetadata(w http.ResponseWriter, r *http.Request) { i.provider.ServeMetadata(w, r) }
func (i *IdP) ServeSSO(w http.ResponseWriter, r *http.Request)      { i.provider.ServeSSO(w, r) }

func parseKeyPair(certPEM, keyPEM string) (crypto.Signer, *x509.Certificate, error) {
	certPEM, keyPEM = strings.TrimSpace(certPEM), strings.TrimSpace(keyPEM)
	if certPEM == "" && keyPEM == "" {
		return nil, nil, nil
	}
	if certPEM == "" || keyPEM == "" {
		return nil, nil, fmt.Errorf("both cert_pem and key_pem must be set (or both empty)")
	}

	certBlock, _ := pem.Decode([]byte(certPEM))
	if certBlock == nil {
		return nil, nil, fmt.Errorf("cert_pem: not a valid PEM block")
	}
	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("parse certificate: %w", err)
	}

	keyBlock, _ := pem.Decode([]byte(keyPEM))
	if keyBlock == nil {
		return nil, nil, fmt.Errorf("key_pem: not a valid PEM block")
	}
	if key, err := x509.ParsePKCS1PrivateKey(keyBlock.Bytes); err == nil {
		return key, cert, nil
	}
	parsed, err := x509.ParsePKCS8PrivateKey(keyBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("parse private key (tried PKCS1 and PKCS8): %w", err)
	}
	signer, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, nil, fmt.Errorf("unsupported private key type %T", parsed)
	}
	return signer, cert, nil
}
