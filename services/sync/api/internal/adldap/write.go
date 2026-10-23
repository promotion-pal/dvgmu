package adldap

import (
	"crypto/tls"
	"fmt"
	"strings"

	goldap "github.com/go-ldap/ldap/v3"
)

// uacNormalDisabled — userAccountControl для обычной выключенной учётки:
// 512 (NORMAL_ACCOUNT) | 2 (ACCOUNTDISABLE). Проверено вручную на тестовом
// Samba AD DC (ldapadd) перед тем, как переносить в код.
const uacNormalDisabled = "514"

// WriteConfig — отдельный, более привилегированный бинд для записи (Create) —
// сознательно НЕ переиспользует read-only AUTH_LDAP_* сервиса auth.
type WriteConfig struct {
	URL                string
	InsecureSkipVerify bool
	BindDN             string
	BindPassword       string
	// TargetOU — полный DN, куда создавать новые учётки, напр.
	// "OU=Test,DC=dvgmu,DC=local". Обязателен — без него AD не даст создать
	// объект.
	TargetOU string
	// UPNSuffix — домен для userPrincipalName, напр. "dvgmu.local".
	UPNSuffix string
}

type WriteClient struct {
	cfg WriteConfig
}

func NewWriteClient(cfg WriteConfig) *WriteClient {
	return &WriteClient{cfg: cfg}
}

// Enabled — задан ли вообще write-бинд. TargetOU (нужен только CreateUser)
// проверяется отдельно в самом CreateUser — SetEmail (Modify по уже
// известному DN) в нём не нуждается.
func (c *WriteClient) Enabled() bool {
	return c != nil && c.cfg.URL != ""
}

type NewUser struct {
	FirstName      string
	LastName       string
	Email          string
	SAMAccountName string
}

type CreatedUser struct {
	ObjectGUID string
}

// CreateUser создаёт учётку **выключенной и без пароля** — sync намеренно не
// генерирует и не выдаёт секреты (пароль пользователя должен назначить и
// включить учётку человек, через ADUC/PowerShell, после проверки записи).
// Единственное, что делает этот метод — Add-объект в AD и возвращает его
// objectGUID для последующей привязки к MDM.
func (c *WriteClient) CreateUser(u NewUser) (*CreatedUser, error) {
	if !c.Enabled() || c.cfg.TargetOU == "" {
		return nil, fmt.Errorf("adldap: write client not configured (need SYNC_LDAP_WRITE_URL and SYNC_LDAP_TARGET_OU)")
	}

	conn, err := c.dialBind()
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	// CN — "ФИО (логин)": уникальность гарантирует логин (он всегда разный,
	// выведен из email), а ФИО спереди — чтобы в ADUC в списке было видно
	// человека, а не только логин (там по умолчанию колонка "Имя" = CN, не
	// displayName). Живой случай коллизии на голом ФИО — "Entry Already
	// Exists" у двух тёзок; голый логин без ФИО — не читаем в ADUC.
	displayName := strings.TrimSpace(u.FirstName + " " + u.LastName)
	cn := u.SAMAccountName
	if displayName != "" {
		cn = fmt.Sprintf("%s (%s)", displayName, u.SAMAccountName)
	}
	// cn ограничен 64 символами в схеме AD — при переполнении откатываемся
	// на голый логин (короткий и уже гарантированно валиден).
	if len(cn) > 64 {
		cn = u.SAMAccountName
	}
	dn := fmt.Sprintf("CN=%s,%s", ldapDNEscape(cn), c.cfg.TargetOU)

	addReq := goldap.NewAddRequest(dn, nil)
	addReq.Attribute("objectClass", []string{"top", "person", "organizationalPerson", "user"})
	addReq.Attribute("cn", []string{cn})
	addReq.Attribute("sAMAccountName", []string{u.SAMAccountName})
	addReq.Attribute("userPrincipalName", []string{u.SAMAccountName + "@" + c.cfg.UPNSuffix})
	addReq.Attribute("givenName", []string{u.FirstName})
	addReq.Attribute("sn", []string{u.LastName})
	if displayName != "" {
		addReq.Attribute("displayName", []string{displayName})
	}
	if u.Email != "" {
		addReq.Attribute("mail", []string{u.Email})
	}
	addReq.Attribute("userAccountControl", []string{uacNormalDisabled})

	if err := conn.Add(addReq); err != nil {
		return nil, fmt.Errorf("create user %q: %w", dn, err)
	}

	searchReq := goldap.NewSearchRequest(dn, goldap.ScopeBaseObject, goldap.NeverDerefAliases, 0, 0, false,
		"(objectClass=*)", []string{"objectGUID"}, nil)
	result, err := conn.Search(searchReq)
	if err != nil || len(result.Entries) != 1 {
		return nil, fmt.Errorf("read back objectGUID for %q: %w", dn, err)
	}

	objectGUID, err := FormatObjectGUID(result.Entries[0].GetRawAttributeValue("objectGUID"))
	if err != nil {
		return nil, fmt.Errorf("objectGUID for %q: %w", dn, err)
	}

	return &CreatedUser{ObjectGUID: objectGUID}, nil
}

func (c *WriteClient) dialBind() (*goldap.Conn, error) {
	conn, err := goldap.DialURL(c.cfg.URL, goldap.DialWithTLSConfig(&tls.Config{
		InsecureSkipVerify: c.cfg.InsecureSkipVerify,
	}))
	if err != nil {
		return nil, fmt.Errorf("dial %s: %w", c.cfg.URL, err)
	}
	if err := conn.Bind(c.cfg.BindDN, c.cfg.BindPassword); err != nil {
		conn.Close()
		return nil, fmt.Errorf("write bind: %w", err)
	}
	return conn, nil
}

func ldapDNEscape(s string) string {
	return goldap.EscapeDN(s)
}
