package config

import (
	"fmt"
	"net"
	"net/url"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Port          int      `env:"GRPC_PORT" env-default:"4000"`
	TimeZone      string   `env:"SCHEDULA_TIME_ZONE" env-default:"Asia/Vladivostok"`
	InternalToken string   `env:"SCHEDULA_INTERNAL_TOKEN" yaml:"-" env-required:"true"`
	MDMURL        string   `env:"PACKAGE_MDM" env-required:"true"`
	Database      Database `yaml:"database"`
}

type Database struct {
	Host     string `env:"DB_HOST" env-default:"localhost"`
	Port     string `env:"DB_PORT" env-default:"5432"`
	User     string `env:"DB_USER" env-default:"postgres"`
	Password string `env:"DB_PASSWORD" yaml:"-"`
	Name     string `env:"DB_NAME" env-default:"schedula"`
	SSLMode  string `env:"DB_SSLMODE" env-default:"disable"`
}

func Load(path string) (Config, error) {
	var c Config
	if err := cleanenv.ReadConfig(path, &c); err != nil {
		return c, err
	}
	target, err := url.Parse(c.MDMURL)
	if err != nil || target.Host == "" || (target.Scheme != "http" && target.Scheme != "https") {
		return c, fmt.Errorf("invalid PACKAGE_MDM")
	}
	if c.Port < 1 || c.Port > 65535 {
		return c, fmt.Errorf("invalid GRPC_PORT")
	}
	return c, nil
}

func (d Database) DSN() string {
	u := url.URL{
		Scheme: "postgres", Host: net.JoinHostPort(d.Host, d.Port), Path: "/" + d.Name,
		User: url.UserPassword(d.User, d.Password),
	}
	u.RawQuery = url.Values{"sslmode": {d.SSLMode}, "connect_timeout": {"5"}}.Encode()
	return u.String()
}
