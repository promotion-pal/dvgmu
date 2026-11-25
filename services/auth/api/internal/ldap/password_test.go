package ldap

import (
	"errors"
	"testing"
)

func TestEncodePassword(t *testing.T) {
	got := []byte(encodePassword("Ab1"))
	want := []byte{'"', 0, 'A', 0, 'b', 0, '1', 0, '"', 0}
	if string(got) != string(want) {
		t.Fatalf("encodePassword = %v, want %v", got, want)
	}
	if len(encodePassword("Пароль")) != (6+2)*2 {
		t.Fatal("cyrillic must be UTF-16LE, 2 bytes per letter")
	}
}

func TestADBindCode(t *testing.T) {
	cases := map[string]string{
		"LDAP Result Code 49 \"Invalid Credentials\": 80090308: LdapErr: DSID-0C09044E, comment: AcceptSecurityContext error, data 773, v4563": "773",
		"... AcceptSecurityContext error, data 52e, v4563": "52e",
		"connection refused":                               "?",
	}
	for msg, want := range cases {
		if got := adBindCode(errors.New(msg)); got != want {
			t.Errorf("%q → %q, want %q", msg, got, want)
		}
	}
	if adBindCode(nil) != "" {
		t.Fatal("nil error must give empty code")
	}
}
