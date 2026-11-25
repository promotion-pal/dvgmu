package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type StudentStorage struct {
	db *gorm.DB
}

func StudentStorageNew(db *gorm.DB) *StudentStorage {
	return &StudentStorage{db: db}
}

// StudentCreate идемпотентен: если у пользователя уже есть студент с той же
// (group, record_book), новая запись не вставляется, а возвращается id
// существующей. Один пользователь при этом может иметь нескольких студентов
// в разных группах.
func (s *StudentStorage) StudentCreate(ctx context.Context, student *models.Student) (int64, error) {
	db := s.db.WithContext(ctx)

	res := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "group"}, {Name: "record_book"}},
		DoNothing: true,
	}).Create(student)
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected > 0 {
		return student.ID, nil
	}

	var existing models.Student
	if err := db.
		Select("id").
		Where(`user_id = ? AND "group" = ? AND record_book = ?`, student.UserID, student.Group, student.RecordBook).
		Take(&existing).Error; err != nil {
		return 0, err
	}
	return existing.ID, nil
}

// StudentFetch отдаёт всех студентов вместе с их пользователем одним SQL
// JOIN (без отдельного запроса на каждого User).
func (s *StudentStorage) StudentFetch(ctx context.Context) ([]*models.Student, error) {
	var records []*models.Student

	if err := s.db.WithContext(ctx).Joins("User").Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}
