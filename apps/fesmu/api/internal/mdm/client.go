// Package mdm reads the MDM user behind a session (services/mdm
// UserService over Connect/JSON). The mdm contract copy here has generated Go
// too, but the proxy path already speaks JSON, so this stays a thin client.
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

	mdmenum "fesmu/contract/mdm/enum"
)

var ErrNotFound = errors.New("mdm: user not found")

type User struct {
	ID        int64
	FirstName string
	LastName  string
	Email     string
}

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{baseURL: strings.TrimRight(baseURL, "/"), httpClient: &http.Client{Timeout: 5 * time.Second}}
}

func (c *Client) ByUUID(ctx context.Context, uuid string) (*User, error) {
	body, err := json.Marshal(map[string]string{"uuid": uuid})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/contract.service.UserService/UserFetchByUUID", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("mdm unreachable: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil, ErrNotFound
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mdm UserFetchByUUID: unexpected status %d", resp.StatusCode)
	}

	var out struct {
		User *struct {
			ID        string `json:"id"` // protojson: int64 as a string
			FirstName string `json:"firstName"`
			LastName  string `json:"lastName"`
			Email     string `json:"email"`
		} `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode mdm response: %w", err)
	}
	if out.User == nil {
		return nil, ErrNotFound
	}
	id, _ := strconv.ParseInt(out.User.ID, 10, 64)
	return &User{ID: id, FirstName: out.User.FirstName, LastName: out.User.LastName, Email: out.User.Email}, nil
}

// Employee is an MDM employee record with its user: one per department the
// person works in.
type Employee struct {
	UUID       string
	Name       string // «Фамилия Имя Отчество»
	Department int32  // UserEmployeeDepartment
	Position   string // должность; пусто, пока не задана
}

// Employees lists every employee with their department (UserService.EmployeeFetch).
func (c *Client) Employees(ctx context.Context) ([]Employee, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/contract.service.UserService/EmployeeFetch", bytes.NewReader([]byte("{}")))
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
		return nil, fmt.Errorf("mdm EmployeeFetch: unexpected status %d", resp.StatusCode)
	}

	var out struct {
		Employees []struct {
			Employee struct {
				Department string `json:"department"` // protojson: enum by name
				Position   string `json:"position"`   // protojson: enum by name
			} `json:"employee"`
			User struct {
				UUID       string `json:"uuid"`
				FirstName  string `json:"firstName"`
				LastName   string `json:"lastName"`
				Patronymic string `json:"patronymic"`
				Position   string `json:"position"`
			} `json:"user"`
		} `json:"employees"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("decode mdm employees: %w", err)
	}
	list := make([]Employee, 0, len(out.Employees))
	for _, e := range out.Employees {
		if e.User.UUID == "" {
			continue
		}
		name := strings.Join(strings.Fields(e.User.LastName+" "+e.User.FirstName+" "+e.User.Patronymic), " ")
		position := mdmenum.UserEmployeePosition_value[e.Employee.Position]
		positionName := strings.TrimPrefix(mdmenum.UserEmployeePosition_name[position], "USER_EMPLOYEE_POSITION_")
		list = append(list, Employee{
			UUID:       e.User.UUID,
			Name:       name,
			Department: mdmenum.UserEmployeeDepartment_value[e.Employee.Department],
			Position:   strings.ReplaceAll(positionName, "_", " "),
		})
	}
	return list, nil
}
