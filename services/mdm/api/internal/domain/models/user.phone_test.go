package models

import (
	"errors"
	"testing"
)

func TestNormalizePhone(t *testing.T) {
	cases := map[string]string{
		"+7(906)5391570":    "+79065391570",
		"79244172079":       "+79244172079",
		"89648254460":       "+79648254460",
		"8 (914) 313-30-75": "+79143133075",
		"9143133075":        "+79143133075",
		"+7 962 224-89-74":  "+79622248974",
		"+7(994)0671726":    "+79940671726",
		"+992 92 123 45 67": "+992921234567",
		"":                  "",
		"   ":               "",
	}
	for raw, want := range cases {
		got, err := NormalizePhone(raw)
		if err != nil {
			t.Fatalf("NormalizePhone(%q): %v", raw, err)
		}
		if got != want {
			t.Errorf("NormalizePhone(%q) = %q, want %q", raw, got, want)
		}
	}
}

func TestNormalizePhoneInvalid(t *testing.T) {
	for _, raw := range []string{"0", "12345", "abc", "мусор", "abc123", "1234567890123456"} {
		if _, err := NormalizePhone(raw); !errors.Is(err, ErrInvalidPhone) {
			t.Errorf("NormalizePhone(%q): expected ErrInvalidPhone, got %v", raw, err)
		}
	}
}

func TestNewUserNormalizesPhone(t *testing.T) {
	raw := "8 (914) 313-30-75"
	u, err := NewUser(UserCreateParams{FirstName: "Иван", LastName: "Иванов", Phone: &raw})
	if err != nil {
		t.Fatalf("NewUser: %v", err)
	}
	if u.Phone == nil || *u.Phone != "+79143133075" {
		t.Fatalf("phone not normalized: %v", u.Phone)
	}

	empty := ""
	u, _ = NewUser(UserCreateParams{FirstName: "Иван", LastName: "Иванов", Phone: &empty})
	if u.Phone != nil {
		t.Fatalf("empty phone should become nil, got %q", *u.Phone)
	}

	bad := "12345"
	if _, err := NewUser(UserCreateParams{FirstName: "Иван", LastName: "Иванов", Phone: &bad}); !errors.Is(err, ErrInvalidPhone) {
		t.Fatalf("expected ErrInvalidPhone, got %v", err)
	}
}
