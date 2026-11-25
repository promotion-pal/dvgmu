package ldap

import (
	"encoding/binary"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf16"

	goldap "github.com/go-ldap/ldap/v3"

	"dvgmu/auth/internal/utils"
)

var (
	// ErrPasswordPolicy — AD не принял пароль: длина, сложность, история.
	ErrPasswordPolicy = errors.New("password does not meet the domain policy")
	// ErrWrongPassword — текущий пароль неверный.
	ErrWrongPassword = errors.New("wrong current password")
	// ErrAccountDisabled — учётка выключена (её включает только активация).
	ErrAccountDisabled = errors.New("account is disabled")
	// ErrNeedsTLS — AD меняет пароль только по LDAPS/StartTLS.
	ErrNeedsTLS = errors.New("password change needs ldaps:// or StartTLS")
)

const (
	uacAccountDisable    = 0x2
	uacPasswordNotNeeded = 0x20
)

// Enabled — сконфигурирована ли запись паролей (служебная учётка с правом
// «Сброс пароля» и защищённое соединение).
func (c *Client) Enabled() bool {
	return c.cfg.URL != "" && c.cfg.BindDN != "" && c.cfg.BindPassword != ""
}

// SetPassword ставит пароль учётке с objectGUID служебной учёткой (право
// «Сброс пароля»): pwdLastSet=-1 — не требовать смены при входе; enable —
// ещё и включить (активация: учётку создают выключенной и без пароля).
// Всё одной операцией: не прошёл пароль по политике — учётка не тронута.
func (c *Client) SetPassword(objectGUID, password string, enable bool) error {
	if !strings.HasPrefix(c.cfg.URL, "ldaps://") && !c.cfg.StartTLS {
		return ErrNeedsTLS
	}
	raw, err := utils.ParseObjectGUID(objectGUID)
	if err != nil {
		return fmt.Errorf("parse objectGUID: %w", err)
	}

	conn, entry, err := c.searchOne(fmt.Sprintf("(objectGUID=%s)", escapeGUIDFilter(raw)), []string{"userAccountControl"})
	if err != nil {
		return err
	}
	defer conn.Close()

	mod := goldap.NewModifyRequest(entry.DN, nil)
	mod.Replace("unicodePwd", []string{encodePassword(password)})
	mod.Replace("pwdLastSet", []string{"-1"})
	if enable {
		uac, err := strconv.Atoi(entry.GetAttributeValue("userAccountControl"))
		if err != nil {
			return fmt.Errorf("userAccountControl: %w", err)
		}
		uac &^= uacAccountDisable | uacPasswordNotNeeded
		mod.Replace("userAccountControl", []string{strconv.Itoa(uac)})
	}

	if err := conn.Modify(mod); err != nil {
		return passwordError(err)
	}
	return nil
}

// CheckPassword — верен ли текущий пароль login. Пароль, который AD требует
// сменить (флаг «сменить при входе» или истёк), тоже считается верным:
// именно для таких и нужна смена. Возвращает objectGUID учётки.
func (c *Client) CheckPassword(login, password string) (string, error) {
	if password == "" {
		return "", ErrWrongPassword
	}
	guid, err := c.ObjectGUIDByLogin(login)
	if errors.Is(err, ErrUserNotFound) {
		return "", ErrWrongPassword
	}
	if err != nil {
		return "", err
	}
	raw, err := utils.ParseObjectGUID(guid)
	if err != nil {
		return "", err
	}

	// Вход самим пользователем: AD отвечает на неверный пароль иначе, чем на
	// верный, но требующий смены (подкод в тексте ошибки 49).
	conn, entry, err := c.searchOne(fmt.Sprintf("(objectGUID=%s)", escapeGUIDFilter(raw)), []string{"userPrincipalName"})
	if err != nil {
		return "", err
	}
	conn.Close()

	userConn, err := c.dial()
	if err != nil {
		return "", fmt.Errorf("dial: %w", err)
	}
	defer userConn.Close()

	bindErr := userConn.Bind(entry.GetAttributeValue("userPrincipalName"), password)
	switch adBindCode(bindErr) {
	case "", "773", "532": // вошёл / сменить при входе / пароль истёк
		return guid, nil
	case "533":
		return "", ErrAccountDisabled
	default:
		return "", ErrWrongPassword
	}
}

// encodePassword — формат unicodePwd: пароль в кавычках, UTF-16LE.
func encodePassword(password string) string {
	units := utf16.Encode([]rune(`"` + password + `"`))
	buf := make([]byte, len(units)*2)
	for i, u := range units {
		binary.LittleEndian.PutUint16(buf[i*2:], u)
	}
	return string(buf)
}

// adBindCode — подкод AD из ошибки bind ("…, data 773, …"); "" — bind прошёл.
func adBindCode(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	i := strings.Index(msg, "data ")
	if i < 0 {
		return "?"
	}
	code := msg[i+len("data "):]
	if j := strings.IndexAny(code, ", "); j >= 0 {
		code = code[:j]
	}
	return code
}

func passwordError(err error) error {
	var ldapErr *goldap.Error
	if errors.As(err, &ldapErr) {
		switch ldapErr.ResultCode {
		case goldap.LDAPResultConstraintViolation:
			return ErrPasswordPolicy
		case goldap.LDAPResultUnwillingToPerform:
			return fmt.Errorf("%w: %v", ErrNeedsTLS, err)
		}
	}
	return fmt.Errorf("modify: %w", err)
}

// MustChangePassword — стоит ли у учётки login флаг «сменить пароль при
// следующем входе» (pwdLastSet = 0). Только чтение служебной учёткой
// (AUTH_LDAP_*): ни попытки входа, ни записи — счётчик блокировки AD не
// трогается. Нет такого логина — false.
func (c *Client) MustChangePassword(login string) (bool, error) {
	login = utils.NormalizeEmail(login)
	sam, _, _ := strings.Cut(login, "@")
	if i := strings.LastIndex(sam, `\`); i >= 0 {
		sam = sam[i+1:]
	}

	conn, entry, err := c.searchOne(fmt.Sprintf(c.cfg.UserFilter, goldap.EscapeFilter(sam)), []string{"pwdLastSet"})
	if errors.Is(err, ErrUserNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	conn.Close()
	return strings.TrimSpace(entry.GetAttributeValue("pwdLastSet")) == "0", nil
}
