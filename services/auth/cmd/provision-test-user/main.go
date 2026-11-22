package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	authservice "dvgmu/auth"
	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/storage"
	"github.com/pressly/goose/v3"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	userID, err := strconv.ParseInt(os.Getenv("AUTH_TEST_USER_ID"), 10, 64)
	if err != nil || userID <= 0 {
		log.Fatal("AUTH_TEST_USER_ID must be a positive MDM user ID")
	}
	email := strings.ToLower(strings.TrimSpace(os.Getenv("AUTH_TEST_EMAIL")))
	password := os.Getenv("AUTH_TEST_PASSWORD")
	if email == "" || password == "" {
		log.Fatal("AUTH_TEST_EMAIL and AUTH_TEST_PASSWORD are required")
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal(err)
	}
	cfg := config.Load()
	db, err := storage.Open(cfg.Database)
	if err != nil {
		log.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal(err)
	}
	if err := goose.SetDialect("postgres"); err != nil {
		log.Fatal(err)
	}
	goose.SetBaseFS(authservice.MigrationsFS)
	goose.SetTableName("goose_db_version_auth")
	if err := goose.Up(sqlDB, "db/migrations"); err != nil {
		log.Fatal(err)
	}
	store := storage.NewIdentityStore(db)
	err = store.Upsert(context.Background(), &storage.TestIdentity{
		MDMUserID:    userID,
		Subject:      fmt.Sprintf("local-user-%d", userID),
		Email:        email,
		PasswordHash: string(passwordHash),
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Test identity stored for MDM user", userID)
}
