package ldap

import (
	"crypto/tls"
	"errors"
	"fmt"
	"strings"

	goldap "github.com/go-ldap/ldap/v3"

	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
)

var (
	ErrUserNotFound       = errors.New("ldap: user not found")
	ErrInvalidCredentials = errors.New("ldap: invalid credentials")
)

var userAttrs = []string{"objectGUID", "displayName", "mail", "department", "telephoneNumber", "sAMAccountName"}

type Config struct {
	URL                string
	StartTLS           bool
	InsecureSkipVerify bool
	BindDN             string
	BindPassword       string
	BaseDN             string
	UserFilter         string
}

type Client struct {
	cfg Config
}

func NewClient(cfg Config) *Client {
	if cfg.UserFilter == "" {
		cfg.UserFilter = "(sAMAccountName=%s)"
	}
	return &Client{cfg: cfg}
}

type UserInfo struct {
	DN          string
	SAMAccount  string
	ObjectGUID  string
	DisplayName string
	Email       string
	Department  string
	Phone       string
}

func (c *Client) Authenticate(login, password string) (*UserInfo, error) {
	login = utils.NormalizeEmail(login)
	samAccountName, _, _ := strings.Cut(login, "@")

	filter := fmt.Sprintf(c.cfg.UserFilter, goldap.EscapeFilter(samAccountName))
	conn, entry, err := c.searchOne(filter, userAttrs)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	objectGUID, err := utils.FormatObjectGUID(entry.GetRawAttributeValue("objectGUID"))
	if err != nil {
		return nil, fmt.Errorf("objectGUID: %w", err)
	}

	if password == "" {
		return nil, ErrInvalidCredentials
	}
	if err := conn.Bind(entry.DN, password); err != nil {
		return nil, ErrInvalidCredentials
	}

	email := utils.NormalizeEmail(entry.GetAttributeValue("mail"))
	if email == "" {
		email = login
	}

	return &UserInfo{
		DN:          entry.DN,
		SAMAccount:  entry.GetAttributeValue("sAMAccountName"),
		ObjectGUID:  objectGUID,
		DisplayName: strings.TrimSpace(entry.GetAttributeValue("displayName")),
		Email:       email,
		Department:  entry.GetAttributeValue("department"),
		Phone:       entry.GetAttributeValue("telephoneNumber"),
	}, nil
}

func (c *Client) Login(login, password string) (*models.User, error) {
	info, err := c.Authenticate(login, password)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) || errors.Is(err, ErrInvalidCredentials) {
			return nil, utils.ErrInvalidCredentials
		}
		return nil, fmt.Errorf("ad authenticate: %w", err)
	}

	return &models.User{
		Email:      info.Email,
		FirstName:  info.DisplayName,
		ExternalID: info.ObjectGUID,
	}, nil
}

func (c *Client) ObjectGUIDByLogin(login string) (string, error) {
	login = utils.NormalizeEmail(login)
	samAccountName, _, _ := strings.Cut(login, "@")

	filter := fmt.Sprintf(c.cfg.UserFilter, goldap.EscapeFilter(samAccountName))
	conn, entry, err := c.searchOne(filter, []string{"objectGUID"})
	if err != nil {
		return "", err
	}
	defer conn.Close()

	return utils.FormatObjectGUID(entry.GetRawAttributeValue("objectGUID"))
}

// UPNByObjectGUID — реальный userPrincipalName из AD. Именно его SCIM-синхронизатор
// Яндекса (adscim, PropertyLoginName по умолчанию) отправляет в Yandex 360 как
// логин, и с ним должен совпадать SAML NameID. Введённый пользователем логин для
// этого не годится: "ivanov@fesmu.ru" и "ivanov" AD FS принимает оба, а UPN в AD
// у этой же учётки может быть "ivanov@dvgmu.local".
func (c *Client) UPNByObjectGUID(objectGUID string) (string, error) {
	raw, err := utils.ParseObjectGUID(objectGUID)
	if err != nil {
		return "", fmt.Errorf("parse objectGUID: %w", err)
	}

	filter := fmt.Sprintf("(objectGUID=%s)", escapeGUIDFilter(raw))
	conn, entry, err := c.searchOne(filter, []string{"userPrincipalName"})
	if err != nil {
		return "", err
	}
	defer conn.Close()

	return strings.TrimSpace(entry.GetAttributeValue("userPrincipalName")), nil
}

func (c *Client) ByObjectGUID(objectGUID string) (*models.User, error) {
	raw, err := utils.ParseObjectGUID(objectGUID)
	if err != nil {
		return nil, fmt.Errorf("parse objectGUID: %w", err)
	}

	filter := fmt.Sprintf("(objectGUID=%s)", escapeGUIDFilter(raw))
	conn, entry, err := c.searchOne(filter, []string{"displayName", "mail"})
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	return &models.User{
		Email:      utils.NormalizeEmail(entry.GetAttributeValue("mail")),
		FirstName:  strings.TrimSpace(entry.GetAttributeValue("displayName")),
		ExternalID: objectGUID,
	}, nil
}

func (c *Client) dialBind() (*goldap.Conn, error) {
	conn, err := c.dial()
	if err != nil {
		return nil, fmt.Errorf("dial: %w", err)
	}
	if err := conn.Bind(c.cfg.BindDN, c.cfg.BindPassword); err != nil {
		conn.Close()
		return nil, fmt.Errorf("service bind: %w", err)
	}
	return conn, nil
}

func (c *Client) searchOne(filter string, attrs []string) (*goldap.Conn, *goldap.Entry, error) {
	conn, err := c.dialBind()
	if err != nil {
		return nil, nil, err
	}

	searchReq := goldap.NewSearchRequest(
		c.cfg.BaseDN,
		goldap.ScopeWholeSubtree, goldap.NeverDerefAliases, 0, 0, false,
		filter, attrs, nil,
	)

	result, err := conn.Search(searchReq)
	if err != nil {
		conn.Close()
		return nil, nil, fmt.Errorf("search: %w", err)
	}
	if len(result.Entries) != 1 {
		conn.Close()
		return nil, nil, ErrUserNotFound
	}
	return conn, result.Entries[0], nil
}

func escapeGUIDFilter(raw [16]byte) string {
	var sb strings.Builder
	for _, b := range raw {
		fmt.Fprintf(&sb, "\\%02x", b)
	}
	return sb.String()
}

func (c *Client) dial() (*goldap.Conn, error) {
	if strings.HasPrefix(c.cfg.URL, "ldaps://") {
		return goldap.DialURL(c.cfg.URL, goldap.DialWithTLSConfig(&tls.Config{
			InsecureSkipVerify: c.cfg.InsecureSkipVerify,
		}))
	}

	conn, err := goldap.DialURL(c.cfg.URL)
	if err != nil {
		return nil, err
	}
	if c.cfg.StartTLS {
		if err := conn.StartTLS(&tls.Config{InsecureSkipVerify: c.cfg.InsecureSkipVerify}); err != nil {
			conn.Close()
			return nil, fmt.Errorf("starttls: %w", err)
		}
	}
	return conn, nil
}
