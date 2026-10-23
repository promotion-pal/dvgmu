package kerberos

import (
	"errors"
	"testing"
)

func TestSamAccountName(t *testing.T) {
	for in, want := range map[string]string{
		"ivanov_ii":               "ivanov_ii",
		" ivanov_ii@dvgmu.local ": "ivanov_ii",
		"ivanov_ii@fesmu.ru":      "ivanov_ii",
		`DVGMU\ivanov_ii`:         "ivanov_ii",
	} {
		if got := samAccountName(in); got != want {
			t.Errorf("%q → %q, want %q", in, got, want)
		}
	}
}

func TestClassify(t *testing.T) {
	cases := map[string]error{
		"[Root cause: KDC_Error] KDC_Error: AS Exchange Error: kerberos error response from KDC: KRB Error: (24) KDC_ERR_PREAUTH_FAILED": ErrWrongPassword,
		"KRB Error: (18) KDC_ERR_CLIENT_REVOKED Clients credentials have been revoked":                                                   ErrAccountDisabled,
		"error response from kadmin: code: 4; result: Password does not meet complexity; krberror: <nil>":                                ErrPasswordPolicy,
		"error response from kadmin: code: 3; result: Authentication error; krberror: <nil>":                                             ErrWrongPassword,
	}
	for msg, want := range cases {
		if got := classify(errors.New(msg)); !errors.Is(got, want) {
			t.Errorf("%q → %v, want %v", msg, got, want)
		}
	}
	if err := classify(errors.New("dial tcp: i/o timeout")); errors.Is(err, ErrWrongPassword) || errors.Is(err, ErrPasswordPolicy) {
		t.Fatalf("network error misclassified: %v", err)
	}
}

func TestEnabled(t *testing.T) {
	if NewChanger(Config{}).Enabled() {
		t.Fatal("empty config must be disabled (stub)")
	}
	if !NewChanger(Config{Realm: "dvgmu.local", KDC: "dc:88", KPasswd: "dc:464"}).Enabled() {
		t.Fatal("full config must be enabled")
	}
}
