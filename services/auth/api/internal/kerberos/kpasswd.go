// Package kerberos — смена пароля пользователем самому себе по протоколу
// kpasswd (как делает Windows при входе): нужен только его текущий пароль,
// без служебной учётки и без LDAPS. Работает и когда AD требует сменить
// пароль («сменить при следующем входе», истёк) — для этого и нужен.
//
// Ходит в KDC (88/tcp) и kpasswd (464/tcp) контроллера домена.
package kerberos

import (
	"errors"
	"fmt"
	"strings"

	"github.com/jcmturner/gokrb5/v8/client"
	"github.com/jcmturner/gokrb5/v8/config"
)

var (
	ErrWrongPassword   = errors.New("wrong current password")
	ErrPasswordPolicy  = errors.New("password does not meet the domain policy")
	ErrAccountDisabled = errors.New("account is disabled or locked")
)

type Config struct {
	// Realm — домен Kerberos заглавными: DVGMU.LOCAL.
	Realm string
	// KDC и KPasswd — host:port контроллера домена (88 и 464).
	KDC     string
	KPasswd string
}

type Changer struct {
	cfg  Config
	krb5 *config.Config
}

func NewChanger(cfg Config) *Changer {
	cfg.Realm = strings.ToUpper(strings.TrimSpace(cfg.Realm))
	k := config.New()
	k.LibDefaults.DefaultRealm = cfg.Realm
	k.LibDefaults.DNSLookupKDC = false
	k.LibDefaults.UDPPreferenceLimit = 1 // только TCP: 88/464 открыты по TCP
	k.Realms = []config.Realm{{
		Realm:         cfg.Realm,
		KDC:           []string{cfg.KDC},
		KPasswdServer: []string{cfg.KPasswd},
		DefaultDomain: strings.ToLower(cfg.Realm),
	}}
	k.DomainRealm = config.DomainRealm{strings.ToLower(cfg.Realm): cfg.Realm, "." + strings.ToLower(cfg.Realm): cfg.Realm}
	return &Changer{cfg: cfg, krb5: k}
}

func (c *Changer) Enabled() bool {
	return c.cfg.Realm != "" && c.cfg.KDC != "" && c.cfg.KPasswd != ""
}

// Change — пароль login: current → next.
func (c *Changer) Change(login, current, next string) error {
	cl := client.NewWithPassword(samAccountName(login), c.cfg.Realm, current, c.krb5, client.DisablePAFXFAST(true))
	defer cl.Destroy()

	if _, err := cl.ChangePasswd(next); err != nil {
		return classify(err)
	}
	return nil
}

func classify(err error) error {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "KDC_ERR_PREAUTH_FAILED"), strings.Contains(msg, "KDC_ERR_C_PRINCIPAL_UNKNOWN"),
		strings.Contains(msg, "code: 3;"): // KRB5_KPASSWD_AUTHERROR
		return ErrWrongPassword
	case strings.Contains(msg, "KDC_ERR_CLIENT_REVOKED"):
		return ErrAccountDisabled
	case strings.Contains(msg, "code: 4;"): // KRB5_KPASSWD_SOFTERROR — политика
		return ErrPasswordPolicy
	}
	return fmt.Errorf("kpasswd: %w", err)
}

// samAccountName — "ivanov" из "ivanov", "ivanov@dvgmu.local", "DVGMU\ivanov".
func samAccountName(login string) string {
	login = strings.TrimSpace(login)
	if i := strings.LastIndex(login, `\`); i >= 0 {
		login = login[i+1:]
	}
	if i := strings.Index(login, "@"); i >= 0 {
		login = login[:i]
	}
	return login
}
