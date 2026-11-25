package config

import (
	"flag"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Env  string     `yaml:"env" env:"ENV" env-default:"local"`
	GRPC GRPCConfig `yaml:"grpc"`
	SMTP SMTPConfig `yaml:"smtp"`
}

type GRPCConfig struct {
	Port               int           `yaml:"port" env:"GRPC_PORT"`
	Timeout            time.Duration `yaml:"timeout" env:"GRPC_TIMEOUT"`
	CORSAllowedOrigins []string      `yaml:"cors_allowed_origins" env:"CORS_ALLOWED_ORIGINS" env-separator:"," env-default:"http://localhost:3000"`
}

type SMTPConfig struct {
	Host          string `yaml:"host" env:"SMTP_HOST"`
	Port          string `yaml:"port" env:"SMTP_PORT" env-default:"587"`
	From          string `yaml:"from" env:"SMTP_FROM"`
	Password      string `yaml:"password" env:"SMTP_PASSWORD"`
	TLSSkipVerify bool   `yaml:"tls_skip_verify" env:"SMTP_TLS_SKIP_VERIFY" env-default:"false"`
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
