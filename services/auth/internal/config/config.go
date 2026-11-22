package config

import "os"

type Config struct {
	Port             string
	Provider         string
	JWTSecret        string
	JWTIssuer        string
	MDMURL           string
	MDMInternalToken string
	CookieSecure     bool
	CookieDomain     string
	Database         Database
}

type Database struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
	SSLMode  string
}

func Load() Config {
	return Config{
		Port:             env("AUTH_PORT", "4053"),
		Provider:         env("AUTH_PROVIDER", "test-db"),
		JWTSecret:        os.Getenv("JWT_SECRET"),
		JWTIssuer:        env("JWT_ISSUER", "dvgmu-auth"),
		MDMURL:           env("AUTH_MDM_URL", "http://localhost:4051"),
		MDMInternalToken: os.Getenv("AUTH_MDM_INTERNAL_TOKEN"),
		CookieSecure:     envBool("AUTH_COOKIE_SECURE", os.Getenv("ENV") == "production"),
		CookieDomain:     os.Getenv("AUTH_COOKIE_DOMAIN"),
		Database: Database{
			Host:     env("DB_HOST", "localhost"),
			Port:     env("DB_PORT", "5448"),
			User:     env("DB_USER", "root"),
			Password: env("DB_PASSWORD", "password"),
			Name:     env("DB_NAME", "dvgmu_auth_db"),
			SSLMode:  env("DB_SSLMODE", "disable"),
		},
	}
}

func envBool(key string, fallback bool) bool {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value == "true" || value == "1"
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
