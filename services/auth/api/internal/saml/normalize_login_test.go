package saml

import "testing"

func TestNormalizeLogin(t *testing.T) {
	cases := []struct {
		suffix, in, want string
	}{
		{"dvgmu.local", "ivanov", "ivanov@dvgmu.local"},
		{"dvgmu.local", "  ivanov  ", "ivanov@dvgmu.local"},
		{"@dvgmu.local", "ivanov", "ivanov@dvgmu.local"},
		{"dvgmu.local", "ivanov@dvgmu.local", "ivanov@dvgmu.local"},
		{"dvgmu.local", "DVGMU\\ivanov", "DVGMU\\ivanov"},
		{"", "ivanov", "ivanov"},
	}
	for _, c := range cases {
		if got := normalizeLogin(c.suffix, c.in); got != c.want {
			t.Errorf("normalizeLogin(%q) suffix=%q = %q, want %q", c.in, c.suffix, got, c.want)
		}
	}
}
