// Package mdm — тонкий клиент к services/mdm.UserService по Connect/JSON:
// после входа через AD пользователь ищется в MDM по objectGUID, при
// обновлении токена — по uuid (свежие роли). mdm — отдельный Go-модуль,
// сгенерированный клиент не тянем, шлём JSON руками (как services/sync).
package mdm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

var (
	// ErrNotFound — в MDM нет пользователя с таким objectGUID/uuid.
	ErrNotFound = errors.New("mdm: user not found")
	// ErrActivationInvalid — код неверный, истёк или нет такого логина.
	ErrActivationInvalid = errors.New("mdm: activation code is invalid or expired")
	// ErrActivationLocked — попытки исчерпаны, нужен новый код.
	ErrActivationLocked = errors.New("mdm: activation attempts exhausted")
)

const statusActive = "USER_STATUS_ACTIVE"

// User — то, что auth кладёт в токены fesmu.
type User struct {
	// ID — users.id в mdm (mdm_id).
	ID        int64
	UUID      string
	Username  string
	Email     string
	FirstName string
	LastName  string
	Active    bool
	// ADObjectID — objectGUID учётки AD; пусто, пока sync её не создал.
	ADObjectID string
	// Roles — без префикса enum: "STUDENT", "STAFF", "TEACHER", "ADMIN".
	Roles []string
	// Permissions — права на действия: "certificate.view" и т.п.
	Permissions []string
}

type Client struct {
	baseURL       string
	internalToken string // MDM_INTERNAL_TOKEN — для служебного UserLinkService
	httpClient    *http.Client
}

func NewClient(baseURL, internalToken string) *Client {
	return &Client{
		baseURL:       strings.TrimRight(baseURL, "/"),
		internalToken: internalToken,
		httpClient:    &http.Client{Timeout: 10 * time.Second},
	}
}

type wireUser struct {
	ID        wireInt64 `json:"id"`
	UUID      string    `json:"uuid"`
	Email     string    `json:"email"`
	FirstName string    `json:"firstName"`
	LastName  string    `json:"lastName"`
	Status    string    `json:"status"`
	Roles     []string  `json:"roles"`
	ADObject  string    `json:"adObjectId"`
	// Старый MDM мог присылать эти поля внутри User; читаем их для переходного периода.
	Username  string   `json:"username"`
	Perms     []string `json:"permissions"`
	Effective []string `json:"effectivePermissions"`
}

// wireInt64 — int64 из Connect JSON: protojson пишет его строкой ("42"),
// но число тоже принимаем. Не разобрали — 0, а не ошибка всего ответа.
type wireInt64 int64

func (n *wireInt64) UnmarshalJSON(b []byte) error {
	v, err := strconv.ParseInt(strings.Trim(string(b), `"`), 10, 64)
	if err == nil {
		*n = wireInt64(v)
	}
	return nil
}

func (u wireUser) permissions() []string {
	if len(u.Effective) > 0 {
		return u.Effective
	}
	return u.Perms
}

func (u wireUser) toUser(username string, permissions []string) *User {
	if username == "" {
		username = u.Username
	}
	if len(permissions) == 0 {
		permissions = u.permissions()
	}
	roles := make([]string, 0, len(u.Roles))
	for _, r := range u.Roles {
		roles = append(roles, strings.TrimPrefix(r, "USER_ROLE_"))
	}
	return &User{
		ID:          int64(u.ID),
		UUID:        u.UUID,
		Username:    username,
		Email:       u.Email,
		FirstName:   u.FirstName,
		LastName:    u.LastName,
		Active:      u.Status == statusActive,
		ADObjectID:  u.ADObject,
		Roles:       roles,
		Permissions: permissions,
	}
}

func (c *Client) ByADObjectID(ctx context.Context, objectGUID string) (*User, error) {
	return c.fetch(ctx, "UserService/UserFetchByADObjectID", map[string]string{"adObjectId": objectGUID})
}

// MDMIDByADObjectID — mdm_id пользователя, связанного с учёткой AD; 0 — не
// связан.
func (c *Client) MDMIDByADObjectID(ctx context.Context, objectGUID string) (int64, error) {
	u, err := c.ByADObjectID(ctx, strings.ToLower(objectGUID))
	if errors.Is(err, ErrNotFound) {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return u.ID, nil
}

func (c *Client) ByUUID(ctx context.Context, uuid string) (*User, error) {
	return c.fetch(ctx, "UserService/UserFetchByUUID", map[string]string{"uuid": uuid})
}

// ActivationVerify — код активации верен (не гасит; неудача = попытка).
func (c *Client) ActivationVerify(ctx context.Context, username, code string) (*User, error) {
	return c.fetch(ctx, "UserLinkService/ActivationVerify", map[string]string{"username": username, "code": code})
}

// ActivationConsume — код верен и погашен.
func (c *Client) ActivationConsume(ctx context.Context, username, code string) (*User, error) {
	return c.fetch(ctx, "UserLinkService/ActivationConsume", map[string]string{"username": username, "code": code})
}

func (c *Client) fetch(ctx context.Context, method string, body map[string]string) (*User, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/contract.service."+method, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.internalToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.internalToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mdm unreachable: %w", err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusNotFound:
		return nil, ErrNotFound
	case http.StatusBadRequest: // InvalidArgument
		return nil, ErrActivationInvalid
	case http.StatusTooManyRequests: // ResourceExhausted
		return nil, ErrActivationLocked
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mdm %s: unexpected status %d", method, resp.StatusCode)
	}

	var out struct {
		User                 *wireUser `json:"user"`
		Username             string    `json:"username"`
		EffectivePermissions []string  `json:"effectivePermissions"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode mdm response: %w", err)
	}
	if out.User == nil {
		return nil, ErrNotFound
	}
	return out.User.toUser(out.Username, out.EffectivePermissions), nil
}
