package config

import (
	"flag"
	"os"
	"time"

	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Env       string          `yaml:"env" env:"ENV" env-default:"local"`
	GRPC      GRPCConfig      `yaml:"grpc"`
	Databases DatabasesConfig `yaml:"databases"`
	Packages  PackagesConfig  `yaml:"packages"`
	Auth      AuthConfig      `yaml:"auth"`
	OneC      OneCConfig      `yaml:"one_c"`
	Deanery   DeaneryConfig   `yaml:"deanery"`
}

// DeaneryConfig — раздел «Деканат». Demo: код можно «выдать» всем студентам;
// тем, кому настоящий нельзя (нет учётки AD, не учится), — демо-код без
// записи в MDM. Выключить — DEANERY_DEMO=false.
type DeaneryConfig struct {
	Demo bool `yaml:"demo" env:"DEANERY_DEMO" env-default:"true"`
}

// OneCConfig — доступ к SQL-базе 1С через WinRM-хост (см. internal/utils/1c).
// Логины и пароли задаются только через ENV.
type OneCConfig struct {
	HostAddr  string        `yaml:"host_addr" env:"ONEC_HOST_ADDR" env-default:"192.168.21.6"`
	HostPort  int           `yaml:"host_port" env:"ONEC_HOST_PORT" env-default:"5985"`
	HostUser  string        `yaml:"-" env:"ONEC_HOST_USER"` // "DVGMU\\user"
	HostPass  string        `yaml:"-" env:"ONEC_HOST_PASSWORD"`
	SQLServer string        `yaml:"sql_server" env:"ONEC_SQL_SERVER" env-default:"192.168.250.2,1433"`
	SQLUser   string        `yaml:"-" env:"ONEC_SQL_USER"` // логин с db_datareader, не sa
	SQLPass   string        `yaml:"-" env:"ONEC_SQL_PASSWORD"`
	DB        string        `yaml:"db" env:"ONEC_DB" env-default:"bgu2"`
	Timeout   time.Duration `yaml:"timeout" env:"ONEC_TIMEOUT" env-default:"60s"`
}

type AuthConfig struct {
	// ServiceURL — auth inside the docker network; empty turns auth off
	// (every RPC is open). Its public key is read from JWKSURL, by default
	// ServiceURL + /.well-known/jwks.json.
	ServiceURL string `yaml:"service_url" env:"AUTH_SERVICE_URL"`
	JWKSURL    string `yaml:"jwks_url" env:"AUTH_JWKS_URL"`
	PublicURL  string `yaml:"public_url" env:"AUTH_PUBLIC_URL" env-default:"https://auth.fesmu.ru"`
	// CookieName — auth's access-token cookie; Issuer/Audience must match
	// AUTH_JWT_ISSUER/AUTH_JWT_AUDIENCE of auth.
	CookieName string `yaml:"cookie_name" env:"AUTH_SESSION_COOKIE_NAME" env-default:"fesmu_at"`
	Issuer     string `yaml:"issuer" env:"AUTH_JWT_ISSUER" env-default:"auth-service"`
	Audience   string `yaml:"audience" env:"AUTH_JWT_AUDIENCE" env-default:"fesmu"`
	// InternalToken is the auth service's AUTH_INTERNAL_TOKEN, sent on the
	// read-only auth/v2 calls proxied to PACKAGE_AUTH.
	InternalToken string `yaml:"-" env:"AUTH_INTERNAL_TOKEN"`
}

type GRPCConfig struct {
	Port           int           `yaml:"port" env:"GRPC_PORT"`
	Timeout        time.Duration `yaml:"timeout" env:"GRPC_TIMEOUT"`
	AllowedOrigins []string      `yaml:"allowed_origins" env:"ALLOWED_ORIGINS" env-separator:","`
}

type PackagesConfig struct {
	MDM       string `yaml:"package_mdm" env:"PACKAGE_MDM"`
	Auth      string `yaml:"package_auth" env:"PACKAGE_AUTH"`
	Files     string `yaml:"package_files" env:"PACKAGE_FILES"`
	Tasks     string `yaml:"package_tasks" env:"PACKAGE_TASKS"`
	Analytics string `yaml:"package_analytics" env:"PACKAGE_ANALYTICS"`
}

type DatabasesConfig struct {
	PurchaseDB       DatabaseConfig `yaml:"purchase_db"`
	InfrastructureDB DatabaseConfig `yaml:"infrastructure_db"`
	// TestDB holds the test builder's tests, apart from everything else.
	TestDB DatabaseConfig `yaml:"test_db"`
	// ExamTestDB keeps examination tests and their attempts apart from regular tests.
	ExamTestDB DatabaseConfig `yaml:"exam_test_db"`
	// LibraryDB holds the library catalog, study manuals and reading positions.
	LibraryDB DatabaseConfig `yaml:"library_db"`
}

type DatabaseConfig struct {
	Host     string `yaml:"host" env-default:"localhost"`
	Port     string `yaml:"port" env-default:"5432"`
	User     string `yaml:"user" env-default:"postgres"`
	Password string `yaml:"password"`
	DBName   string `yaml:"dbname"`
	SSLMode  string `yaml:"sslmode" env-default:"disable"`
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

	applyDatabaseEnvOverrides(&cfg)

	return &cfg
}

func applyDatabaseEnvOverrides(cfg *Config) {
	overrideDatabase(&cfg.Databases.PurchaseDB,
		"POSTGRES_HOST_PURCHASE", "POSTGRES_PORT_PURCHASE", "POSTGRES_USER_PURCHASE",
		"POSTGRES_PASSWORD_PURCHASE", "POSTGRES_DB_PURCHASE", "DB_SSLMODE")

	overrideDatabase(&cfg.Databases.InfrastructureDB,
		"INFRASTRUCTURE_POSTGRES_HOST", "INFRASTRUCTURE_POSTGRES_PORT", "INFRASTRUCTURE_POSTGRES_USER",
		"INFRASTRUCTURE_POSTGRES_PASSWORD", "INFRASTRUCTURE_POSTGRES_DB", "DB_SSLMODE")

	overrideDatabase(&cfg.Databases.TestDB,
		"TEST_POSTGRES_HOST", "TEST_POSTGRES_PORT", "TEST_POSTGRES_USER",
		"TEST_POSTGRES_PASSWORD", "TEST_POSTGRES_DB", "DB_SSLMODE")

	overrideDatabase(&cfg.Databases.ExamTestDB,
		"EXAM_TEST_POSTGRES_HOST", "EXAM_TEST_POSTGRES_PORT", "EXAM_TEST_POSTGRES_USER",
		"EXAM_TEST_POSTGRES_PASSWORD", "EXAM_TEST_POSTGRES_DB", "DB_SSLMODE")

	overrideDatabase(&cfg.Databases.LibraryDB,
		"POSTGRES_HOST_LIBRARY", "POSTGRES_PORT_LIBRARY", "POSTGRES_USER_LIBRARY",
		"POSTGRES_PASSWORD_LIBRARY", "POSTGRES_DB_LIBRARY", "DB_SSLMODE")
}

func overrideDatabase(db *DatabaseConfig, hostKey, portKey, userKey, passwordKey, dbNameKey, sslModeKey string) {
	if v := os.Getenv(hostKey); v != "" {
		db.Host = v
	}
	if v := os.Getenv(portKey); v != "" {
		db.Port = v
	}
	if v := os.Getenv(userKey); v != "" {
		db.User = v
	}
	if v := os.Getenv(passwordKey); v != "" {
		db.Password = v
	}
	if v := os.Getenv(dbNameKey); v != "" {
		db.DBName = v
	}
	if v := os.Getenv(sslModeKey); v != "" {
		db.SSLMode = v
	}
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
