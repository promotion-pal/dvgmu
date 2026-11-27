package main

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"dvgmu/mdm/internal/config"
	"dvgmu/mdm/internal/domain/models"
	"dvgmu/mdm/internal/storage"
	enum "fesmu/contract/mdm/enum"
	"gorm.io/gorm"
)

func main() {
	cfg := config.MustLoad()
	db, err := storage.New(cfg.Database, slog.Default())
	if err != nil {
		fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		fatal(err)
	}
	defer sqlDB.Close()

	reader := bufio.NewReader(os.Stdin)
	firstName := prompt(reader, "Имя")
	lastName := prompt(reader, "Фамилия")
	patronymic := prompt(reader, "Отчество (необязательно)")
	email := prompt(reader, "Email")
	user, err := models.NewUser(models.UserCreateParams{
		FirstName:  firstName,
		LastName:   lastName,
		Patronymic: patronymic,
		Email:      email,
	})
	if err != nil {
		fatal(fmt.Errorf("проверьте имя, фамилию и email: %w", err))
	}
	if err := db.WithContext(context.Background()).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return fmt.Errorf("создать пользователя: %w", err)
		}
		if err := tx.Create(&models.UserRole{UserID: user.ID, Role: enum.UserRole_USER_ROLE_ADMIN}).Error; err != nil {
			return fmt.Errorf("назначить роль ADMIN: %w", err)
		}
		return nil
	}); err != nil {
		fatal(err)
	}
	fmt.Printf("Создан администратор MDM: ID=%d, email=%s\n", user.ID, user.Email)
}

func prompt(reader *bufio.Reader, label string) string {
	fmt.Printf("%s: ", label)
	value, err := reader.ReadString('\n')
	if err != nil && len(value) == 0 {
		fatal(fmt.Errorf("не удалось прочитать %s: %w", label, err))
	}
	return strings.TrimSpace(value)
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
