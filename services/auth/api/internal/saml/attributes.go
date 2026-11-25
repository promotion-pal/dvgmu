package saml

import (
	"encoding/base64"
	"fmt"
	"regexp"
	"strings"

	crewjamsaml "github.com/crewjam/saml"

	"dvgmu/auth/internal/utils"
)

// Имена claim'ов, которые AD FS кладёт в ассерцию. Совпадают с тем, что
// Yandex 360 просит настроить на стороне AD FS (User.EmailAddress и т.п.),
// плюс стандартные WS-* URI на случай другой раскладки claim rules.
var (
	emailAttrNames = []string{
		"User.EmailAddress",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
		"email",
	}
	firstNameAttrNames = []string{
		"User.Firstname",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
		"givenname",
		// В части claim rules AD FS вместо givenname настроен на выдачу
		// стандартного WS-Identity claim "name" (значение — Имя [Отчество],
		// без фамилии) — живой пример: raw_attributes без givenname, но с
		// name=Павел Игоревич. Без этого имя терялось целиком.
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name",
		"name",
	}
	lastNameAttrNames = []string{
		"User.Surname",
		"http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
		"surname",
	}
)

var guidCanonicalRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// UserAttributes — данные пользователя, извлечённые из ассерции AD FS.
type UserAttributes struct {
	Email      string
	FirstName  string
	LastName   string
	ObjectGUID string // канонический вид; пусто, если AD FS не отдал claim
}

// FullName — "Имя Фамилия" без лишних пробелов.
func (u UserAttributes) FullName() string {
	return strings.TrimSpace(u.FirstName + " " + u.LastName)
}

// attrsFromAssertion разбирает ассерцию AD FS. guidClaim — имя claim с
// objectGUID (пусто → GUID резолвится отдельным LDAP-поиском выше по стеку).
func attrsFromAssertion(a *crewjamsaml.Assertion, guidClaim string) (UserAttributes, error) {
	// email может отсутствовать (у части учёток AD не заполнен mail) — тогда
	// вызывающий код достраивает его из логина по AUTH_SAML_IDP_EMAIL_DOMAIN.
	attrs := UserAttributes{
		Email:     utils.NormalizeEmail(firstAttr(a, emailAttrNames)),
		FirstName: strings.TrimSpace(firstAttr(a, firstNameAttrNames)),
		LastName:  strings.TrimSpace(firstAttr(a, lastNameAttrNames)),
	}

	if guidClaim != "" {
		if raw := strings.TrimSpace(firstAttr(a, []string{guidClaim})); raw != "" {
			guid, err := decodeGUIDClaim(raw)
			if err != nil {
				return UserAttributes{}, fmt.Errorf("object guid claim %q: %w", guidClaim, err)
			}
			attrs.ObjectGUID = guid
		}
	}

	return attrs, nil
}

func decodeGUIDClaim(v string) (string, error) {
	if guidCanonicalRe.MatchString(v) {
		return strings.ToLower(v), nil
	}
	if b, err := base64.StdEncoding.DecodeString(v); err == nil && len(b) == 16 {
		return utils.FormatObjectGUID(b)
	}
	return "", fmt.Errorf("unrecognized objectGUID format %q", v)
}

// dumpAttributes сериализует все claim'ы ассерции в "Name=value1|value2" —
// чисто для диагностики в логах (см. session.go), поведение входа от неё
// не зависит. Ничего секретного тут нет — те же данные и так уходят в Yandex 360.
func dumpAttributes(assertion *crewjamsaml.Assertion) []string {
	var out []string
	for _, stmt := range assertion.AttributeStatements {
		for _, attr := range stmt.Attributes {
			name := attr.Name
			if attr.FriendlyName != "" && attr.FriendlyName != name {
				name += "(" + attr.FriendlyName + ")"
			}
			values := make([]string, 0, len(attr.Values))
			for _, v := range attr.Values {
				values = append(values, v.Value)
			}
			out = append(out, name+"="+strings.Join(values, "|"))
		}
	}
	return out
}

func firstAttr(assertion *crewjamsaml.Assertion, names []string) string {
	for _, stmt := range assertion.AttributeStatements {
		for _, attr := range stmt.Attributes {
			for _, name := range names {
				if attr.Name != name && attr.FriendlyName != name {
					continue
				}
				for _, v := range attr.Values {
					if v.Value != "" {
						return v.Value
					}
				}
			}
		}
	}
	return ""
}
