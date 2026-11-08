package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"fesmu/contract/mdm/enum"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type EmployeeStorage struct {
	db *gorm.DB
}

func EmployeeStorageNew(db *gorm.DB) *EmployeeStorage {
	return &EmployeeStorage{db: db}
}

// EmployeeCreate идемпотентен: если у пользователя уже есть сотрудник в том
// же отделе, новая запись не вставляется, а возвращается id существующей.
func (s *EmployeeStorage) EmployeeCreate(ctx context.Context, employee *models.Employee) (int64, error) {
	db := s.db.WithContext(ctx)
	if employee.SourceKey != nil && *employee.SourceKey != "" {
		if err := db.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "source_key"}},
			DoUpdates: clause.AssignmentColumns([]string{"user_id", "department", "status", "position", "updated_at"}),
		}).Create(employee).Error; err != nil {
			return 0, err
		}
		var existing models.Employee
		if err := db.Select("id").Where("source_key = ?", *employee.SourceKey).Take(&existing).Error; err != nil {
			return 0, err
		}
		return existing.ID, nil
	}

	var existing models.Employee
	err := db.Where("user_id = ? AND department = ? AND position = ? AND source_key IS NULL", employee.UserID, employee.Department, employee.Position).Take(&existing).Error
	if err == nil {
		if err := db.Model(&existing).Updates(map[string]any{"status": employee.Status, "updated_at": employee.UpdatedAt}).Error; err != nil {
			return 0, err
		}
		return existing.ID, nil
	}
	if err != gorm.ErrRecordNotFound {
		return 0, err
	}
	if err := db.Create(employee).Error; err != nil {
		return 0, err
	}
	return employee.ID, nil
}

// EmployeeFetch отдаёт всех сотрудников вместе с их пользователем одним
// SQL JOIN (без отдельного запроса на каждого User).
func (s *EmployeeStorage) EmployeeFetch(ctx context.Context) ([]*models.Employee, error) {
	var records []*models.Employee

	if err := s.db.WithContext(ctx).Joins("User").Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

// EmployeeDepartmentsSet приводит записи сотрудника человека ровно к deps:
// лишние удаляет, недостающие добавляет. Пустой deps — убрать все.
func (s *EmployeeStorage) EmployeeDepartmentsSet(ctx context.Context, userID int64, deps []enum.UserEmployeeDepartment) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&models.User{}).Where("id = ?", userID).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return models.ErrUserNotFound
		}
		del := tx.Where("user_id = ?", userID)
		if len(deps) > 0 {
			del = del.Where("department NOT IN ?", deps)
		}
		if err := del.Where("source_key IS NULL").Delete(&models.Employee{}).Error; err != nil {
			return err
		}
		if len(deps) == 0 {
			return nil
		}
		for _, d := range deps {
			var count int64
			if err := tx.Model(&models.Employee{}).Where("user_id = ? AND department = ?", userID, d).Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				continue
			}
			row := models.Employee{UserID: userID, Department: d}
			if err := tx.Omit("User").Create(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
