package adldap

import "testing"

func TestIsDisabled(t *testing.T) {
	cases := map[string]bool{
		"512": false, // NORMAL_ACCOUNT
		"514": true,  // NORMAL_ACCOUNT | ACCOUNTDISABLE
		"544": false,
		"546": true,
		"":    false,
		"abc": false,
	}
	for uac, want := range cases {
		if got := isDisabled(uac); got != want {
			t.Errorf("isDisabled(%q) = %v, want %v", uac, got, want)
		}
	}
}
