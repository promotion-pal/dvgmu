// Package adldap — read-only bulk-чтение Active Directory для сверки с MDM.
// Только поиск, никакой записи: тот же read-only service-бинд, что уже
// использует services/auth для LDAP-фолбэка (AUTH_LDAP_*), новых прав не
// требует.
package adldap

import (
	"crypto/tls"
	"fmt"
	"strconv"
	"strings"

	goldap "github.com/go-ldap/ldap/v3"
)

type Config struct {
	URL                string
	StartTLS           bool
	InsecureSkipVerify bool
	BindDN             string
	BindPassword       string
	BaseDN             string
	// AllUsersFilter — фильтр bulk-поиска, напр.
	// "(&(objectCategory=person)(objectClass=user))".
	AllUsersFilter string
}

type Client struct {
	cfg Config
}

func NewClient(cfg Config) *Client {
	return &Client{cfg: cfg}
}

// Entry — то, что нужно сверке из одной AD-записи.
type Entry struct {
	DN             string // нужен для последующих Modify (см. WriteClient.SetEmail)
	ObjectGUID     string
	Email          string
	DisplayName    string
	SAMAccountName string
	Disabled       bool // бит ACCOUNTDISABLE в userAccountControl
}

const accountDisableBit = 0x2

var entryAttrs = []string{"objectGUID", "mail", "displayName", "userAccountControl", "sAMAccountName"}

// FetchAll — bulk-поиск всех учётных записей людей под BaseDN.
func (c *Client) FetchAll() ([]Entry, error) {
	conn, err := c.dialBind()
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	var out []Entry
	pagingControl := goldap.NewControlPaging(1000)

	for {
		req := goldap.NewSearchRequest(
			c.cfg.BaseDN,
			goldap.ScopeWholeSubtree, goldap.NeverDerefAliases, 0, 0, false,
			c.cfg.AllUsersFilter, entryAttrs, []goldap.Control{pagingControl},
		)

		result, err := conn.Search(req)
		if err != nil {
			return nil, fmt.Errorf("search: %w", err)
		}

		for _, e := range result.Entries {
			guid, err := FormatObjectGUID(e.GetRawAttributeValue("objectGUID"))
			if err != nil {
				// objectGUID у людей всегда есть и всегда 16 байт — если нет,
				// это не человек (сервисная/системная запись) или битые
				// данные; пропускаем, не роняем весь проход.
				continue
			}
			out = append(out, Entry{
				DN:             e.DN,
				ObjectGUID:     guid,
				Email:          strings.ToLower(strings.TrimSpace(e.GetAttributeValue("mail"))),
				DisplayName:    strings.TrimSpace(e.GetAttributeValue("displayName")),
				SAMAccountName: strings.ToLower(strings.TrimSpace(e.GetAttributeValue("sAMAccountName"))),
				Disabled:       isDisabled(e.GetAttributeValue("userAccountControl")),
			})
		}

		next := findPagingControl(result.Controls)
		if next == nil || len(next.Cookie) == 0 {
			return out, nil
		}
		pagingControl.SetCookie(next.Cookie)
	}
}

func isDisabled(userAccountControl string) bool {
	v, err := strconv.Atoi(userAccountControl)
	if err != nil {
		return false
	}
	return v&accountDisableBit != 0
}

func findPagingControl(controls []goldap.Control) *goldap.ControlPaging {
	for _, ctrl := range controls {
		if p, ok := ctrl.(*goldap.ControlPaging); ok {
			return p
		}
	}
	return nil
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
