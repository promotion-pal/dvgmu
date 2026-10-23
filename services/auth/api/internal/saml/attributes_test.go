package saml

import (
	"encoding/base64"
	"encoding/xml"
	"strings"
	"testing"

	crewjamsaml "github.com/crewjam/saml"
)

func mustAssertion(t *testing.T, raw string) *crewjamsaml.Assertion {
	t.Helper()
	var a crewjamsaml.Assertion
	if err := xml.Unmarshal([]byte(raw), &a); err != nil {
		t.Fatalf("unmarshal assertion: %v", err)
	}
	return &a
}

const adfsAssertion = `<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_1" Version="2.0" IssueInstant="2026-09-08T00:00:00Z">
  <Issuer>http://adfs.example</Issuer>
  <AttributeStatement>
    <Attribute Name="User.EmailAddress"><AttributeValue>  Ivanov@FESMU.ru </AttributeValue></Attribute>
    <Attribute Name="User.Firstname"><AttributeValue>Иван</AttributeValue></Attribute>
    <Attribute Name="User.Surname"><AttributeValue>Иванов</AttributeValue></Attribute>
    <Attribute Name=" objectGUID "><AttributeValue>ignored</AttributeValue></Attribute>
  </AttributeStatement>
</Assertion>`

func TestAttrsFromAssertion(t *testing.T) {
	guidRaw := make([]byte, 16)
	for i := range guidRaw {
		guidRaw[i] = byte(i + 1)
	}
	b64 := base64.StdEncoding.EncodeToString(guidRaw)

	assertion := mustAssertion(t, `<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_1" Version="2.0" IssueInstant="2026-09-08T00:00:00Z">
  <Issuer>x</Issuer>
  <AttributeStatement>
    <Attribute Name="User.EmailAddress"><AttributeValue>Ivanov@FESMU.ru</AttributeValue></Attribute>
    <Attribute Name="User.Firstname"><AttributeValue>Иван</AttributeValue></Attribute>
    <Attribute Name="User.Surname"><AttributeValue>Иванов</AttributeValue></Attribute>
    <Attribute Name="objectGUID"><AttributeValue>`+b64+`</AttributeValue></Attribute>
  </AttributeStatement>
</Assertion>`)

	attrs, err := attrsFromAssertion(assertion, "objectGUID")
	if err != nil {
		t.Fatalf("attrsFromAssertion: %v", err)
	}
	if attrs.Email != "ivanov@fesmu.ru" {
		t.Errorf("email = %q", attrs.Email)
	}
	if attrs.FullName() != "Иван Иванов" {
		t.Errorf("full name = %q", attrs.FullName())
	}
	if attrs.ObjectGUID != "04030201-0605-0807-090a-0b0c0d0e0f10" {
		t.Errorf("objectGUID = %q", attrs.ObjectGUID)
	}
}

// Живой случай (2026-09-11, mordovtsev_pi): AD FS отдаёт имя не через
// givenname, а через стандартный claim "name" (Имя Отчество, без фамилии).
// Раньше это терялось целиком — FirstName оставался пустым.
func TestAttrsFromAssertion_FirstNameViaNameClaim(t *testing.T) {
	a := mustAssertion(t, `<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_1" Version="2.0" IssueInstant="2026-09-11T00:00:00Z">
  <Issuer>adfs</Issuer>
  <AttributeStatement>
    <Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"><AttributeValue>Павел Игоревич</AttributeValue></Attribute>
    <Attribute Name="http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"><AttributeValue>Мордовцев</AttributeValue></Attribute>
  </AttributeStatement>
</Assertion>`)

	attrs, err := attrsFromAssertion(a, "")
	if err != nil {
		t.Fatalf("attrsFromAssertion: %v", err)
	}
	if attrs.FirstName != "Павел Игоревич" {
		t.Errorf("first name = %q, want %q", attrs.FirstName, "Павел Игоревич")
	}
	if attrs.LastName != "Мордовцев" {
		t.Errorf("last name = %q", attrs.LastName)
	}
}

func TestAttrsFromAssertion_NoEmail(t *testing.T) {
	// email отсутствует — не ошибка: достраивается выше по стеку из логина
	a := mustAssertion(t, `<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_1" Version="2.0" IssueInstant="2026-09-08T00:00:00Z"><Issuer>x</Issuer></Assertion>`)
	attrs, err := attrsFromAssertion(a, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if attrs.Email != "" {
		t.Fatalf("want empty email, got %q", attrs.Email)
	}
}

func TestLocalPart(t *testing.T) {
	for in, want := range map[string]string{
		"ivanov":             "ivanov",
		"ivanov@dvgmu.local": "ivanov",
		`DVGMU\ivanov`:       "ivanov",
		`dvgmu.local\ivanov`: "ivanov",
	} {
		if got := localPart(in); got != want {
			t.Errorf("localPart(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAttrsFromAssertion_GUIDFromLDAPFallback(t *testing.T) {
	attrs, err := attrsFromAssertion(mustAssertion(t, adfsAssertion), "")
	if err != nil {
		t.Fatalf("attrsFromAssertion: %v", err)
	}
	if attrs.ObjectGUID != "" {
		t.Errorf("expected empty objectGUID without a claim name, got %q", attrs.ObjectGUID)
	}
	if attrs.Email != "ivanov@fesmu.ru" {
		t.Errorf("email = %q", attrs.Email)
	}
}

func TestDecodeGUIDClaim_Canonical(t *testing.T) {
	got, err := decodeGUIDClaim("04030201-0605-0807-090a-0b0c0d0e0f10")
	if err != nil || got != "04030201-0605-0807-090a-0b0c0d0e0f10" {
		t.Fatalf("got %q, err %v", got, err)
	}
}

func TestDumpAttributes(t *testing.T) {
	a := mustAssertion(t, `<Assertion xmlns="urn:oasis:names:tc:SAML:2.0:assertion" ID="_1" Version="2.0" IssueInstant="2026-09-08T00:00:00Z">
  <Issuer>x</Issuer>
  <AttributeStatement>
    <Attribute Name="User.EmailAddress"><AttributeValue>derbentsev@fesmu.ru</AttributeValue></Attribute>
    <Attribute Name="User.Surname"><AttributeValue>Дербенцев</AttributeValue></Attribute>
  </AttributeStatement>
</Assertion>`)

	got := dumpAttributes(a)
	want := []string{"User.EmailAddress=derbentsev@fesmu.ru", "User.Surname=Дербенцев"}
	if len(got) != len(want) {
		t.Fatalf("got %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v, want %v", got, want)
		}
	}
	// главное диагностическое свойство: User.Firstname тут не появится вовсе —
	// именно так по логу отличают "claim'а нет" от "claim пуст".
	for _, s := range got {
		if strings.HasPrefix(s, "User.Firstname") {
			t.Fatalf("User.Firstname must be absent, not just empty: %v", got)
		}
	}
}
