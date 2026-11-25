package config

import (
	"flag"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Env            string           `yaml:"env" env:"ENV" env-default:"local"`
	GRPC           GRPCConfig       `yaml:"grpc"`
	Database       DatabaseConfig   `yaml:"database"`
	Encryption     EncryptionConfig `yaml:"encryption"`
	AllowedOrigins []string         `yaml:"allowed_origins" env:"ALLOWED_ORIGINS" env-separator:","`
	// InternalToken — секрет служебных RPC (UserLinkService). Пусто — они
	// отклоняют любой запрос.
	InternalToken string `yaml:"-" env:"MDM_INTERNAL_TOKEN"`
}

type GRPCConfig struct {
	Port    int           `yaml:"port" env:"GRPC_PORT"`
	Timeout time.Duration `yaml:"timeout" env:"GRPC_TIMEOUT"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host" env:"POSTGRES_HOST" env-default:"localhost"`
	Port     string `yaml:"port" env:"POSTGRES_PORT" env-default:"5432"`
	User     string `yaml:"user" env:"POSTGRES_USER" env-default:"postgres"`
	Password string `yaml:"password" env:"POSTGRES_PASSWORD"`
	DBName   string `yaml:"dbname" env:"POSTGRES_DB"`
	SSLMode  string `yaml:"sslmode" env:"DB_SSLMODE" env-default:"disable"`
}

type EncryptionConfig struct {
	PassportKey string `yaml:"passport_key" env:"PASSPORT_ENCRYPTION_KEY"`
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
