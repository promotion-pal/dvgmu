package main

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"net/mail"
	"os"
	"strconv"
	"strings"
	"time"

	"connectrpc.com/connect"
	authservice "dvgmu/auth"
	"dvgmu/auth/internal/config"
	"dvgmu/auth/internal/storage"
	mdmenum "fesmu/contract/mdm/enum"
	mdmservice "fesmu/contract/mdm/service"
	"fesmu/contract/mdm/service/serviceconnect"
	"github.com/pressly/goose/v3"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	values, err := readInput(bufio.NewReader(os.Stdin))
	if err != nil {
		fatal(err)
	}
	userID, err := strconv.ParseInt(values[0], 10, 64)
	if err != nil || userID <= 0 {
		fatal(fmt.Errorf("ID пользователя MDM должен быть положительным числом"))
	}
	email := strings.ToLower(strings.TrimSpace(values[1]))
	address, err := mail.ParseAddress(email)
	if err != nil || address.Address != email {
		fatal(fmt.Errorf("укажите корректный email"))
	}
	password := values[2]
	if len(password) < 8 {
		fatal(fmt.Errorf("пароль должен содержать не менее 8 символов"))
	}

	cfg := config.Load()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	mdmClient := serviceconnect.NewUserServiceClient(&http.Client{Timeout: 5 * time.Second}, cfg.MDMURL)
	mdmRequest := connect.NewRequest(&mdmservice.UserFetchByIDRequest{Id: userID})
	mdmRequest.Header().Set("X-Internal-Service-Token", cfg.MDMInternalToken)
	mdmResponse, err := mdmClient.UserFetchByID(ctx, mdmRequest)
	if err != nil {
		fatal(fmt.Errorf("пользователь MDM с ID %d недоступен: %w", userID, err))
	}
	user := mdmResponse.Msg.GetUser()
	if user == nil || user.GetStatus() != mdmenum.UserStatus_USER_STATUS_ACTIVE {
		fatal(fmt.Errorf("пользователь MDM с ID %d отсутствует или неактивен", userID))
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		fatal(fmt.Errorf("не удалось обработать пароль: %w", err))
	}
	db, err := storage.Open(cfg.Database)
	if err != nil {
		fatal(fmt.Errorf("открыть базу Auth: %w", err))
	}
	sqlDB, err := db.DB()
	if err != nil {
		fatal(err)
	}
	defer sqlDB.Close()
	if err := goose.SetDialect("postgres"); err != nil {
		fatal(err)
	}
	goose.SetBaseFS(authservice.MigrationsFS)
	goose.SetTableName("goose_db_version_auth")
	if err := goose.Up(sqlDB, "db/migrations"); err != nil {
		fatal(fmt.Errorf("применить миграции Auth: %w", err))
	}

	identity := &storage.AuthIdentity{
		MDMUserID:    userID,
		Subject:      fmt.Sprintf("auth-user-%d", userID),
		Email:        email,
		PasswordHash: string(passwordHash),
	}
	if err := storage.NewIdentityStore(db).Upsert(context.Background(), identity); err != nil {
		fatal(fmt.Errorf("сохранить учетные данные: %w", err))
	}
	fmt.Printf("Данные для входа сохранены: MDM ID=%d, email=%s\n", userID, email)
}

func readInput(reader *bufio.Reader) ([3]string, error) {
	var values [3]string
	for i, label := range []string{"ID пользователя MDM", "Email", "Пароль"} {
		value, err := reader.ReadString('\n')
		if err != nil && len(value) == 0 {
			return values, fmt.Errorf("не удалось прочитать %s", label)
		}
		values[i] = strings.TrimRight(value, "\r\n")
	}
	return values, nil
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
