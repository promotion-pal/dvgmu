package storage

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"dvgmu/api/internal/domain/models"
)

type ActivationStorage struct {
	db *gorm.DB
}

func ActivationStorageNew(db *gorm.DB) *ActivationStorage {
	return &ActivationStorage{db: db}
}

// ActivationIssue заменяет действующий код пользователя новым (старый
// перестаёт работать).
func (s *ActivationStorage) ActivationIssue(ctx context.Context, userID int64, codeHash string, expiresAt time.Time) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("user_id = ? AND used_at IS NULL", userID).Delete(&models.ActivationCode{}).Error; err != nil {
			return err
		}
		return tx.Create(&models.ActivationCode{UserID: userID, CodeHash: codeHash, ExpiresAt: expiresAt}).Error
	})
}

// ActivationCheck проверяет действующий код пользователя с логином username
// через match (сравнение с хешем). Несовпадение — attempts+1, и это
// сохраняется, хотя метод вернёт ошибку. consume=true при совпадении гасит
// код. Строка кода блокируется на время проверки — параллельные попытки не
// обойдут лимит.
func (s *ActivationStorage) ActivationCheck(
	ctx context.Context,
	username string,
	match func(codeHash string) bool,
	consume bool,
) (*models.User, error) {
	var (
		user   models.User
		result error
	)
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		err := tx.Preload("Roles").Preload("Permissions").Preload("AccessGroups.Permissions").First(&user, "lower(username) = ?", strings.ToLower(strings.TrimSpace(username))).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			result = models.ErrActivationInvalid
			return nil
		}
		if err != nil {
			return err
		}

		var code models.ActivationCode
		err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&code, "user_id = ? AND used_at IS NULL", user.ID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			result = models.ErrActivationInvalid
			return nil
		}
		if err != nil {
			return err
		}

		switch {
		case time.Now().After(code.ExpiresAt):
			result = models.ErrActivationInvalid
			return nil
		case code.Attempts >= models.ActivationMaxAttempts:
			result = models.ErrActivationLocked
			return nil
		case !match(code.CodeHash):
			result = models.ErrActivationInvalid
			return tx.Model(&code).Update("attempts", gorm.Expr("attempts + 1")).Error
		case consume:
			return tx.Model(&code).Update("used_at", time.Now()).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if result != nil {
		return nil, result
	}
	return &user, nil
}
