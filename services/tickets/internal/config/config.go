package config

import (
	"flag"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Env                 string         `yaml:"env" env:"ENV" env-default:"local"`
	GRPC                GRPCConfig     `yaml:"grpc"`
	Database            DatabaseConfig `yaml:"database"`
	MDM                 MDMConfig      `yaml:"mdm"`
	GatewaySharedSecret string         `env:"GATEWAY_SHARED_SECRET"`
}

type MDMConfig struct {
	URL string `yaml:"url" env:"MDM_URL" env-default:"http://localhost:4051"`
}

type GRPCConfig struct {
	Port    int           `yaml:"port" env:"GRPC_PORT"`
	Timeout time.Duration `yaml:"timeout" env:"GRPC_TIMEOUT"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host" env:"DB_HOST" env-default:"localhost"`
	Port     string `yaml:"port" env:"DB_PORT" env-default:"5432"`
	User     string `yaml:"user" env:"DB_USER" env-default:"postgres"`
	Password string `yaml:"password" env:"DB_PASSWORD"`
	DBName   string `yaml:"dbname" env:"DB_NAME"`
	SSLMode  string `yaml:"sslmode" env:"DB_SSLMODE" env-default:"disable"`
}

func MustLoad() *Config {
	path := os.Getenv("CONFIG_PATH")
	if path == "" {
		flag.StringVar(&path, "config", "", "configuration file path")
		flag.Parse()
	}
	if path == "" {
		path = "config/local.yaml"
	}
	if _, err := os.Stat(path); err != nil {
		panic("config file does not exist: " + path)
	}
	var cfg Config
	if err := cleanenv.ReadConfig(path, &cfg); err != nil {
		panic("cannot read config: " + err.Error())
	}
	return &cfg
}
