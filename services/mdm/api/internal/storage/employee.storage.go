package storage

import (
	"context"
	"fesmu/contract/mdm/enum"
	"dvgmu/api/internal/domain/models"

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

	res := db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "department"}},
		DoNothing: true,
	}).Create(employee)
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected > 0 {
		return employee.ID, nil
	}

	var existing models.Employee
	if err := db.
		Select("id").
		Where("user_id = ? AND department = ?", employee.UserID, employee.Department).
		Take(&existing).Error; err != nil {
		return 0, err
	}
	return existing.ID, nil
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
		if err := del.Delete(&models.Employee{}).Error; err != nil {
			return err
		}
		if len(deps) == 0 {
			return nil
		}
		rows := make([]models.Employee, 0, len(deps))
		for _, d := range deps {
			rows = append(rows, models.Employee{UserID: userID, Department: d})
		}
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "department"}},
			DoNothing: true,
		}).Omit("User").Create(&rows).Error
	})
}
