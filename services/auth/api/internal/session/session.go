// Package session — токены fesmu для пользователей, связанных с MDM.
//
// После входа через AD (SAML для Yandex 360 или /login) auth ищет человека в
// MDM по objectGUID. Нашёлся и активен — выдаются две HttpOnly-cookie:
// access-JWT (15 мин, EdDSA, sub = mdm uuid, username, roles) и refresh-токен
// (30 дней, в БД только хеш, ротация с отзывом всей семьи при повторе). Не
// нашёлся — ErrNotLinked: вход в Yandex 360 это не блокирует, fesmu получит
// 403 not_linked на /me.
package session

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/mdm"
	"dvgmu/auth/internal/utils"
)

const (
	MePath      = "/api/v1/auth/me"
	RefreshPath = "/api/v1/auth/refresh"
	LogoutPath  = "/api/v1/auth/logout"
	JWKSPath    = "/.well-known/jwks.json"

	// refreshCookiePath — refresh-cookie уходит только на эти эндпоинты auth.
	refreshCookiePath = "/api/v1/auth"
)

type Directory interface {
	ByADObjectID(ctx context.Context, objectGUID string) (*mdm.User, error)
	ByUUID(ctx context.Context, uuid string) (*mdm.User, error)
}

type Store interface {
	RefreshTokenCreate(ctx context.Context, t *models.RefreshToken) error
	RefreshTokenByHash(ctx context.Context, hash []byte) (*models.RefreshToken, error)
	RefreshTokenRotate(ctx context.Context, oldID string, next *models.RefreshToken) error
	RefreshTokenRevokeFamily(ctx context.Context, familyID string) error
}

// SSO — сессия самого IdP (вход через AD, есть и у не связанных с MDM).
// Нужна /me, чтобы отличить «не связан с MDM» от «не вошёл», и /logout —
// чтобы выйти полностью.
type SSO interface {
	// ObjectGUID — objectGUID из действующей SSO-сессии; ok=false — её нет.
	ObjectGUID(r *http.Request) (guid string, ok bool)
	Clear(w http.ResponseWriter, r *http.Request)
}

// AccessClaims — содержимое access-токена.
type AccessClaims struct {
	Username string   `json:"username"`
	Roles    []string `json:"roles"`
	// Perms — права на отдельные действия (из MDM).
	Perms []string `json:"perms,omitempty"`
	jwt.RegisteredClaims
}

type Manager struct {
	cfg    config.SessionConfig
	signer *Signer
	dir    Directory
	store  Store
	sso    SSO
	log    *slog.Logger
	now    func() time.Time
}

func NewManager(cfg config.SessionConfig, signer *Signer, dir Directory, store Store, sso SSO, log *slog.Logger) *Manager {
	if log == nil {
		log = slog.Default()
	}
	return &Manager{cfg: cfg, signer: signer, dir: dir, store: store, sso: sso, log: log, now: time.Now}
}

// Start выдаёт токены fesmu после успешного входа через AD. ErrNotLinked —
// в MDM нет активного пользователя с этим objectGUID.
func (m *Manager) Start(ctx context.Context, w http.ResponseWriter, r *http.Request, objectGUID string) error {
	user, err := m.dir.ByADObjectID(ctx, strings.ToLower(objectGUID))
	if errors.Is(err, mdm.ErrNotFound) || (err == nil && !user.Active) {
		return utils.ErrNotLinked
	}
	if err != nil {
		return err
	}

	refresh, err := m.newRefresh(user.UUID, uuid.NewString(), r)
	if err != nil {
		return err
	}
	if err := m.store.RefreshTokenCreate(ctx, refresh.row); err != nil {
		return err
	}
	return m.setCookies(w, r, user, refresh)
}

// ServeMe — текущий пользователь fesmu по access-cookie.
//
//	200 {uuid, username, roles}
//	401 {"error":"expired"}         — access истёк, есть refresh: вызвать refresh
//	403 {"error":"not_linked"}      — вошёл через AD, но в MDM не связан
//	401 {"error":"unauthenticated"} — не вошёл (или токены fesmu потеряны при
//	                                  живой SSO-сессии: /login выдаст их без пароля)
func (m *Manager) ServeMe(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(m.cfg.AccessCookie); err == nil {
		if claims, err := m.Verify(c.Value); err == nil {
			writeJSON(w, http.StatusOK, meBody(claims.Subject, claims.Username, claims.Roles, claims.Perms))
			return
		}
	}
	if hasCookie(r, m.cfg.RefreshCookie) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "expired"})
		return
	}
	if m.sso != nil {
		if guid, ok := m.sso.ObjectGUID(r); ok {
			user, err := m.dir.ByADObjectID(r.Context(), strings.ToLower(guid))
			if errors.Is(err, mdm.ErrNotFound) || (err == nil && !user.Active) {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "not_linked"})
				return
			}
		}
	}
	writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthenticated"})
}

// ServeRefresh — POST: ротация refresh-токена, новая пара cookie, тело как у /me.
func (m *Manager) ServeRefresh(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method_not_allowed"})
		return
	}
	ctx := r.Context()

	c, err := r.Cookie(m.cfg.RefreshCookie)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthenticated"})
		return
	}
	current, err := m.store.RefreshTokenByHash(ctx, hashToken(c.Value))
	if err != nil {
		m.deny(w, r, err)
		return
	}
	if current.RevokedAt != nil {
		// Отозванный токен предъявили повторно — считаем украденным.
		m.log.Warn("session: revoked refresh token reused, revoking family",
			"user_uuid", current.UserID, "family_id", current.FamilyID)
		_ = m.store.RefreshTokenRevokeFamily(ctx, current.FamilyID)
		m.deny(w, r, utils.ErrInvalidToken)
		return
	}
	if m.now().After(current.ExpiresAt) {
		m.deny(w, r, utils.ErrInvalidToken)
		return
	}

	// Роли берём из MDM заново — изменения применяются не позже чем через AccessTTL.
	user, err := m.dir.ByUUID(ctx, current.UserID)
	if errors.Is(err, mdm.ErrNotFound) || (err == nil && !user.Active) {
		_ = m.store.RefreshTokenRevokeFamily(ctx, current.FamilyID)
		m.deny(w, r, utils.ErrNotLinked)
		return
	}
	if err != nil {
		m.log.Error("session: mdm lookup on refresh failed", "error", err.Error())
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "unavailable"})
		return
	}

	next, err := m.newRefresh(user.UUID, current.FamilyID, r)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	if err := m.store.RefreshTokenRotate(ctx, current.ID, next.row); err != nil {
		m.deny(w, r, err)
		return
	}
	if err := m.setCookies(w, r, user, next); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal"})
		return
	}
	writeJSON(w, http.StatusOK, meBody(user.UUID, user.Username, user.Roles, user.Permissions))
}

// ServeLogout — POST: отзывает refresh-семью, стирает cookie fesmu и
// SSO-сессию IdP.
func (m *Manager) ServeLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method_not_allowed"})
		return
	}
	if c, err := r.Cookie(m.cfg.RefreshCookie); err == nil {
		if t, err := m.store.RefreshTokenByHash(r.Context(), hashToken(c.Value)); err == nil {
			_ = m.store.RefreshTokenRevokeFamily(r.Context(), t.FamilyID)
		}
	}
	m.clearCookies(w, r)
	if m.sso != nil {
		m.sso.Clear(w, r)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (m *Manager) ServeJWKS(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write(m.signer.JWKS())
}

// Verify проверяет access-токен (подпись, iss, aud, exp).
func (m *Manager) Verify(raw string) (*AccessClaims, error) {
	claims := &AccessClaims{}
	_, err := jwt.ParseWithClaims(raw, claims,
		func(*jwt.Token) (any, error) { return m.signer.Public(), nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodEdDSA.Alg()}),
		jwt.WithIssuer(m.cfg.Issuer),
		jwt.WithAudience(m.cfg.Audience),
		jwt.WithTimeFunc(m.now),
	)
	if err != nil {
		return nil, utils.ErrInvalidToken
	}
	return claims, nil
}

func (m *Manager) issueAccess(user *mdm.User) (string, time.Time, error) {
	now := m.now()
	exp := now.Add(m.cfg.AccessTTL)
	tok := jwt.NewWithClaims(jwt.SigningMethodEdDSA, AccessClaims{
		Username: user.Username,
		Roles:    user.Roles,
		Perms:    user.Permissions,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.UUID,
			Issuer:    m.cfg.Issuer,
			Audience:  jwt.ClaimStrings{m.cfg.Audience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        uuid.NewString(),
		},
	})
	tok.Header["kid"] = m.signer.kid
	signed, err := tok.SignedString(m.signer.priv)
	return signed, exp, err
}

type refreshToken struct {
	raw string
	row *models.RefreshToken
}

func (m *Manager) newRefresh(userUUID, familyID string, r *http.Request) (*refreshToken, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	raw := base64.RawURLEncoding.EncodeToString(buf)
	return &refreshToken{raw: raw, row: &models.RefreshToken{
		ID:         uuid.NewString(),
		UserID:     userUUID,
		FamilyID:   familyID,
		TokenHash:  hashToken(raw),
		ExpiresAt:  m.now().Add(m.cfg.RefreshTTL),
		DeviceInfo: deviceInfo(r),
	}}, nil
}

func (m *Manager) setCookies(w http.ResponseWriter, r *http.Request, user *mdm.User, refresh *refreshToken) error {
	access, exp, err := m.issueAccess(user)
	if err != nil {
		return err
	}
	secure := isHTTPS(r)
	http.SetCookie(w, &http.Cookie{
		Name: m.cfg.AccessCookie, Value: access, Path: "/", Domain: m.cfg.CookieDomain,
		Expires: exp, MaxAge: int(m.cfg.AccessTTL.Seconds()),
		HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name: m.cfg.RefreshCookie, Value: refresh.raw, Path: refreshCookiePath,
		Expires: refresh.row.ExpiresAt, MaxAge: int(m.cfg.RefreshTTL.Seconds()),
		HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode,
	})
	return nil
}

func (m *Manager) clearCookies(w http.ResponseWriter, r *http.Request) {
	secure := isHTTPS(r)
	http.SetCookie(w, &http.Cookie{
		Name: m.cfg.AccessCookie, Path: "/", Domain: m.cfg.CookieDomain, MaxAge: -1,
		HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode,
	})
	http.SetCookie(w, &http.Cookie{
		Name: m.cfg.RefreshCookie, Path: refreshCookiePath, MaxAge: -1,
		HttpOnly: true, Secure: secure, SameSite: http.SameSiteStrictMode,
	})
}

func (m *Manager) deny(w http.ResponseWriter, r *http.Request, err error) {
	m.clearCookies(w, r)
	code := "unauthenticated"
	if errors.Is(err, utils.ErrNotLinked) {
		code = "not_linked"
	}
	writeJSON(w, http.StatusUnauthorized, map[string]string{"error": code})
}

func meBody(uuid, username string, roles, perms []string) map[string]any {
	if roles == nil {
		roles = []string{}
	}
	if perms == nil {
		perms = []string{}
	}
	return map[string]any{"uuid": uuid, "username": username, "roles": roles, "permissions": perms}
}

func hashToken(raw string) []byte {
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}

func hasCookie(r *http.Request, name string) bool {
	c, err := r.Cookie(name)
	return err == nil && c.Value != ""
}

func deviceInfo(r *http.Request) string {
	ip := r.Header.Get("X-Forwarded-For")
	if i := strings.IndexByte(ip, ','); i >= 0 {
		ip = ip[:i]
	}
	if ip = strings.TrimSpace(ip); ip == "" {
		ip, _, _ = net.SplitHostPort(r.RemoteAddr)
	}
	info := ip + " " + r.UserAgent()
	if len(info) > 255 {
		info = info[:255]
	}
	return info
}

func isHTTPS(r *http.Request) bool {
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
