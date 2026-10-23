package models

import (
	"regexp"
	"testing"
)

func TestGenActivationCode(t *testing.T) {
	format := regexp.MustCompile(`^[2345679ACDEFGHJKMNPQRTUVWXYZ]{4}-[2345679ACDEFGHJKMNPQRTUVWXYZ]{4}$`)
	seen := map[string]bool{}
	for range 200 {
		code, err := GenActivationCode()
		if err != nil {
			t.Fatal(err)
		}
		if !format.MatchString(code) {
			t.Fatalf("bad format: %q", code)
		}
		seen[code] = true
	}
	if len(seen) < 199 {
		t.Fatalf("codes repeat: %d unique of 200", len(seen))
	}
}

func TestNormalizeActivationCode(t *testing.T) {
	for in, want := range map[string]string{
		"ab3d-ef7h":   "AB3DEF7H",
		" AB3D EF7H ": "AB3DEF7H",
		"AB3DEF7H":    "AB3DEF7H",
	} {
		if got := NormalizeActivationCode(in); got != want {
			t.Errorf("%q → %q, want %q", in, got, want)
		}
	}
}
