package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"dvgmu/mdm/internal/domain/models"
	"gorm.io/gorm"
)

type UserStorage struct {
	db *gorm.DB
}

func NewUserStorage(db *gorm.DB) *UserStorage {
	return &UserStorage{db: db}
}

func (s *UserStorage) UserFetch(ctx context.Context) ([]models.User, error) {
	var users []models.User
	err := s.userQuery(ctx).Order("id").Find(&users).Error
	if err != nil {
		return nil, fmt.Errorf("fetch users: %w", err)
	}
	return users, nil
}

func (s *UserStorage) UserByID(ctx context.Context, id int64) (*models.User, error) {
	var user models.User
	err := s.userQuery(ctx).First(&user, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrUserNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("fetch user %d: %w", id, err)
	}
	return &user, nil
}

func (s *UserStorage) UserCreate(ctx context.Context, user *models.User) error {
	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			return models.ErrUserAlreadyExists
		}
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (s *UserStorage) UserUpdate(ctx context.Context, user *models.User) error {
	result := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", user.ID).Updates(map[string]any{
		"first_name": user.FirstName,
		"last_name":  user.LastName,
		"patronymic": user.Patronymic,
		"email":      user.Email,
		"phone":      user.Phone,
		"birthday":   user.Birthday,
		"status":     user.Status,
		"updated_at": time.Now(),
	})
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrDuplicatedKey) {
			return models.ErrUserAlreadyExists
		}
		return fmt.Errorf("update user %d: %w", user.ID, result.Error)
	}
	if result.RowsAffected == 0 {
		return models.ErrUserNotFound
	}
	return nil
}

func (s *UserStorage) userQuery(ctx context.Context) *gorm.DB {
	return s.db.WithContext(ctx)
}

func ensureUserExists(tx *gorm.DB, id int64) error {
	var count int64
	if err := tx.Model(&models.User{}).Where("id = ?", id).Count(&count).Error; err != nil {
		return fmt.Errorf("check user exists: %w", err)
	}
	if count == 0 {
		return models.ErrUserNotFound
	}
	return nil
}
