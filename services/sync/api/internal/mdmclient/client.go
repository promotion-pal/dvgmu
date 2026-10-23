// Package mdmclient — тонкий клиент к services/mdm.UserService по
// Connect/JSON (тот же паттерн, что services/auth/internal/mdm.Client: mdm —
// отдельный Go-модуль, сгенерённый клиент не тянем, шлём JSON руками).
package mdmclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	baseURL       string
	internalToken string
	httpClient    *http.Client
}

// internalToken — MDM_INTERNAL_TOKEN, нужен только для записи (LinkAD).
func NewClient(baseURL, internalToken string) *Client {
	return &Client{
		baseURL:       strings.TrimRight(baseURL, "/"),
		internalToken: internalToken,
		httpClient:    &http.Client{Timeout: 15 * time.Second},
	}
}

// int64String — protojson кодирует int64 как JSON-строку (та же особенность,
// что уже встречалась в services/auth/internal/mdm/client.go и
// dgmu.v2/internal/auth/interceptor.go).
type int64String int64

func (n *int64String) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "" || s == "null" {
		*n = 0
		return nil
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return fmt.Errorf("int64String: %w", err)
	}
	*n = int64String(v)
	return nil
}

// User — то, что реально нужно сверке из mdm.entity.User.
type User struct {
	ID         int64
	FirstName  string
	LastName   string
	Patronymic string
	Email      string
	Status     string // "USER_STATUS_ACTIVE" / "USER_STATUS_INACTIVE" / ...
	ADObjectID string // objectGUID связанной учётки AD, пусто — не связан
}

type wireUser struct {
	ID         int64String `json:"id"`
	FirstName  string      `json:"firstName"`
	LastName   string      `json:"lastName"`
	Patronymic string      `json:"patronymic"`
	Email      string      `json:"email"`
	Status     string      `json:"status"`
	ADObjectID string      `json:"adObjectId"`
}

func (u wireUser) toUser() User {
	return User{
		ID:         int64(u.ID),
		FirstName:  u.FirstName,
		LastName:   u.LastName,
		Patronymic: u.Patronymic,
		Email:      u.Email,
		Status:     u.Status,
		ADObjectID: u.ADObjectID,
	}
}

type fetchResponse struct {
	Users []wireUser `json:"users"`
}

// FetchAll — mdm.UserService.UserFetch не пагинирован, отдаёт всю таблицу.
func (c *Client) FetchAll(ctx context.Context) ([]User, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/contract.service.UserService/UserFetch", bytes.NewReader([]byte("{}")))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mdm unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mdm: unexpected status %d", resp.StatusCode)
	}

	var out fetchResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode mdm response: %w", err)
	}

	users := make([]User, 0, len(out.Users))
	for _, u := range out.Users {
		users = append(users, u.toUser())
	}
	return users, nil
}

// ADLink — связка пользователя MDM с учёткой AD.
type ADLink struct {
	MDMID      int64
	ObjectGUID string
}

type wireADLink struct {
	ID         int64String `json:"id"`
	AdObjectID string      `json:"adObjectId"`
}

type linkResponse struct {
	Linked  int64String  `json:"linked"`
	Skipped []wireADLink `json:"skipped"`
}

// LinkAD пишет связки в mdm (UserLinkService.UserADLinkBatch). mdm не
// перезаписывает чужие/уже заполненные GUID — они возвращаются в skipped.
func (c *Client) LinkAD(ctx context.Context, links []ADLink) (int64, []ADLink, error) {
	wire := make([]map[string]string, 0, len(links))
	for _, l := range links {
		wire = append(wire, map[string]string{
			"id":         strconv.FormatInt(l.MDMID, 10),
			"adObjectId": l.ObjectGUID,
		})
	}
	body, err := json.Marshal(map[string]any{"links": wire})
	if err != nil {
		return 0, nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/contract.service.UserLinkService/UserADLinkBatch", bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.internalToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, nil, fmt.Errorf("mdm unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, nil, fmt.Errorf("mdm: UserADLinkBatch unexpected status %d", resp.StatusCode)
	}

	var out linkResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return 0, nil, fmt.Errorf("decode mdm response: %w", err)
	}

	skipped := make([]ADLink, 0, len(out.Skipped))
	for _, l := range out.Skipped {
		skipped = append(skipped, ADLink{MDMID: int64(l.ID), ObjectGUID: l.AdObjectID})
	}
	return int64(out.Linked), skipped, nil
}
