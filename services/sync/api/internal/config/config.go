package config

import (
	"flag"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Env       string          `yaml:"env" env:"ENV" env-default:"local"`
	Interval  time.Duration   `yaml:"interval" env:"SYNC_INTERVAL" env-default:"1h"`
	MDM       MDMConfig       `yaml:"mdm"`
	LDAP      LDAPConfig      `yaml:"ldap"`
	LDAPWrite LDAPWriteConfig `yaml:"ldap_write"`
}

type MDMConfig struct {
	ServiceURL string `yaml:"service_url" env:"MDM_SERVICE_URL"`
	// InternalToken — тот же секрет, что MDM_INTERNAL_TOKEN у mdm, нужен
	// только для записи связок (UserLinkService.UserADLinkBatch).
	InternalToken string `yaml:"internal_token" env:"MDM_INTERNAL_TOKEN"`
}

type LDAPConfig struct {
	URL                string `yaml:"url" env:"AUTH_LDAP_URL"`
	StartTLS           bool   `yaml:"start_tls" env:"AUTH_LDAP_START_TLS" env-default:"false"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify" env:"AUTH_LDAP_INSECURE_SKIP_VERIFY" env-default:"false"`
	BindDN             string `yaml:"bind_dn" env:"AUTH_LDAP_BIND_DN"`
	BindPassword       string `yaml:"bind_password" env:"AUTH_LDAP_BIND_PASSWORD"`
	BaseDN             string `yaml:"base_dn" env:"AUTH_LDAP_BASE_DN"`
	AllUsersFilter     string `yaml:"all_users_filter" env:"SYNC_LDAP_ALL_USERS_FILTER" env-default:"(&(objectCategory=person)(objectClass=user))"`
}

// LDAPWriteConfig — отдельный, более привилегированный бинд для записи в AD
// (Create) — сознательно НЕ переиспользует read-only LDAPConfig выше.
// Обычный ldap:// (без TLS) подходит: sync создаёт учётки без пароля
// (см. adldap.CreateUser), а установка пароля — единственная операция,
// которую AD требует делать только по ldaps:///StartTLS — здесь не нужна.
// Пусто (URL или TargetOU) — write-режим (-create-missing) недоступен, но
// обычный read-only проход работает как обычно.
type LDAPWriteConfig struct {
	URL                string `yaml:"url" env:"SYNC_LDAP_WRITE_URL"`
	InsecureSkipVerify bool   `yaml:"insecure_skip_verify" env:"SYNC_LDAP_WRITE_INSECURE_SKIP_VERIFY" env-default:"false"`
	BindDN             string `yaml:"bind_dn" env:"SYNC_LDAP_WRITE_BIND_DN"`
	BindPassword       string `yaml:"bind_password" env:"SYNC_LDAP_WRITE_BIND_PASSWORD"`
	// TargetOU — полный DN, куда создавать новые учётки, напр.
	// "OU=Test,DC=dvgmu,DC=local".
	TargetOU string `yaml:"target_ou" env:"SYNC_LDAP_TARGET_OU"`
	// UPNSuffix — домен для userPrincipalName, напр. "dvgmu.local".
	UPNSuffix string `yaml:"upn_suffix" env:"SYNC_LDAP_UPN_SUFFIX"`
}

func MustLoad() *Config {
	configPath := fetchConfigPath()
	if configPath == "" {
		panic("config path is empty")
	}
	return MustLoadPath(configPath)
}

func MustLoadPath(configPath string) *Config {
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		panic("config file does not exist: " + configPath)
	}

	var cfg Config
	if err := cleanenv.ReadConfig(configPath, &cfg); err != nil {
		panic("cannot read config: " + err.Error())
	}
	return &cfg
}

func fetchConfigPath() string {
	var res string

	if !flag.Parsed() {
		flag.StringVar(&res, "config", "", "path to config file")
		flag.Parse()
	}

	if res == "" {
		res = os.Getenv("CONFIG_PATH")
	}
	return res
}
