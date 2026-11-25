package storage

import (
	"context"
	"errors"
	"log/slog"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"dvgmu/analytics/internal/domain/models"
)

type UserStorage struct {
	db  *gorm.DB
	log *slog.Logger
}

func UserStorageNew(db *gorm.DB, log *slog.Logger) *UserStorage {
	return &UserStorage{
		db:  db,
		log: log,
	}
}

// Upsert создаёт студента или обновляет его данные, если запись с таким
// телефоном уже есть (телефон — естественный ключ студента).
func (s *UserStorage) Upsert(ctx context.Context, user *models.User) (int64, error) {
	err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "phone"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"last_name", "first_name", "patronymic", "record_book", "group", "updated_at",
			}),
		}).
		Create(user).Error
	if err != nil {
		s.log.Error("failed to upsert user", "error", err.Error())
		return 0, err
	}
	return user.ID, nil
}

func (s *UserStorage) ByID(ctx context.Context, id int64) (*models.User, error) {
	var user models.User
	if err := s.db.WithContext(ctx).First(&user, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		s.log.Error("failed to fetch user by id", "id", id, "error", err.Error())
		return nil, err
	}
	return &user, nil
}

func (s *UserStorage) Fetch(ctx context.Context) ([]models.User, error) {
	var users []models.User
	if err := s.db.WithContext(ctx).Order("id").Find(&users).Error; err != nil {
		s.log.Error("failed to fetch users", "error", err.Error())
		return nil, err
	}
	return users, nil
}
