package storage

import (
	"context"
	"fesmu/contract/mdm/enum"
	"dvgmu/api/internal/domain/models"
	"errors"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type UserStorage struct {
	db *gorm.DB
}

func UserStorageNew(db *gorm.DB) *UserStorage {
	return &UserStorage{db: db}
}

func (s *UserStorage) UserFetch(ctx context.Context) ([]*models.User, error) {
	var records []*models.User

	if err := s.db.WithContext(ctx).Preload("Roles").Preload("Permissions").Preload("AccessGroups.Permissions").Preload("Employees").Order("id").Find(&records).Error; err != nil {
		return nil, err
	}

	return records, withDepartmentGroups(s.db.WithContext(ctx), records...)
}

func (s *UserStorage) UserByID(ctx context.Context, id int64) (*models.User, error) {
	var record models.User

	err := s.db.WithContext(ctx).
		Preload("Passport").
		Preload("Educations").
		Preload("Military").
		Preload("Student").
		Preload("Employee").
		Preload("Roles").Preload("Permissions").Preload("AccessGroups.Permissions").Preload("Employees").
		First(&record, "id = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrUserNotFound
		}
		return nil, err
	}

	return &record, withDepartmentGroups(s.db.WithContext(ctx), &record)
}

func (s *UserStorage) UserByEmail(ctx context.Context, email string) (*models.User, error) {
	var record models.User

	err := s.db.WithContext(ctx).
		Preload("Passport").
		Preload("Educations").
		Preload("Military").
		Preload("Student").
		Preload("Employee").
		Preload("Roles").Preload("Permissions").Preload("AccessGroups.Permissions").Preload("Employees").
		First(&record, "email = ?", email).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrUserNotFound
		}
		return nil, err
	}

	return &record, withDepartmentGroups(s.db.WithContext(ctx), &record)
}

// UsersByFullName отдаёт всех с совпадающими фамилией и именем (без учёта
// регистра) вместе со связями — окончательное решение "тот же ли это человек"
// принимает models.User.SamePersonAs по остальным полям.
func (s *UserStorage) UsersByFullName(ctx context.Context, lastName, firstName string) ([]*models.User, error) {
	var records []*models.User

	err := s.db.WithContext(ctx).
		Preload("Passport").
		Preload("Educations").
		Preload("Military").
		Preload("Student").
		Preload("Employee").
		Preload("Roles").Preload("Permissions").Preload("AccessGroups.Permissions").Preload("Employees").
		Where("lower(last_name) = lower(?) AND lower(first_name) = lower(?)", strings.TrimSpace(lastName), strings.TrimSpace(firstName)).
		Find(&records).Error
	if err != nil {
		return nil, err
	}

	return records, withDepartmentGroups(s.db.WithContext(ctx), records...)
}

func (s *UserStorage) UserExistsByEmail(ctx context.Context, email string) (bool, error) {
	var count int64

	if err := s.db.WithContext(ctx).Model(&models.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		return false, err
	}

	return count > 0, nil
}

func (s *UserStorage) UserCreate(ctx context.Context, user *models.User) (int64, error) {
	if err := s.db.WithContext(ctx).Create(user).Error; err != nil {
		return 0, err
	}
	return user.ID, nil
}

func (s *UserStorage) UserUpdate(ctx context.Context, user *models.User) error {
	res := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", user.ID).Updates(user)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrUserNotFound
	}
	return nil
}

// UserPositionSet задаёт должность; пустая строка тоже записывается (снять).
func (s *UserStorage) UserPositionSet(ctx context.Context, userID int64, position string) error {
	res := s.db.WithContext(ctx).Model(&models.User{}).Where("id = ?", userID).Update("position", position)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrUserNotFound
	}
	return nil
}

func (s *UserStorage) UserDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.User{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrUserNotFound
	}
	return nil
}

// UserDeleteBatch удаляет пользователей пачкой (связанные записи уходят
// каскадом на уровне БД) и возвращает, сколько реально удалено.
func (s *UserStorage) UserDeleteBatch(ctx context.Context, ids []int64) (int64, error) {
	res := s.db.WithContext(ctx).Delete(&models.User{}, "id IN ?", ids)
	if res.Error != nil {
		return 0, res.Error
	}
	return res.RowsAffected, nil
}

func (s *UserStorage) UserByUUID(ctx context.Context, id string) (*models.User, error) {
	if _, err := uuid.Parse(id); err != nil {
		return nil, models.ErrUserNotFound
	}

	var record models.User
	err := s.db.WithContext(ctx).Preload("Roles").Preload("Permissions").Preload("AccessGroups.Permissions").Preload("Employees").First(&record, "uuid = ?", id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrUserNotFound
		}
		return nil, err
	}

	return &record, withDepartmentGroups(s.db.WithContext(ctx), &record)
}

func (s *UserStorage) UserByADObjectID(ctx context.Context, objectID string) (*models.User, error) {
	if _, err := uuid.Parse(objectID); err != nil {
		return nil, models.ErrUserNotFound
	}

	var record models.User
	err := s.db.WithContext(ctx).Preload("Roles").Preload("Permissions").Preload("AccessGroups.Permissions").Preload("Employees").First(&record, "ad_object_id = ?", objectID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrUserNotFound
		}
		return nil, err
	}

	return &record, withDepartmentGroups(s.db.WithContext(ctx), &record)
}

// UserRolesSet приводит роли пользователя ровно к набору roles: лишние
// удаляет, недостающие добавляет (у оставшихся сохраняется created_at).
func (s *UserStorage) UserRolesSet(ctx context.Context, userID int64, roles []enum.UserRole) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&models.User{}).Where("id = ?", userID).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return models.ErrUserNotFound
		}

		del := tx.Where("user_id = ?", userID)
		if len(roles) > 0 {
			del = del.Where("role NOT IN ?", roles)
		}
		if err := del.Delete(&models.UserRole{}).Error; err != nil {
			return err
		}
		if len(roles) == 0 {
			return nil
		}

		rows := make([]models.UserRole, 0, len(roles))
		for _, r := range roles {
			rows = append(rows, models.UserRole{UserID: userID, Role: r})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
}

// UserADLinkBatch выставляет ad_object_id. Не перезаписывает другой уже
// заполненный GUID и не берёт GUID, занятый другим пользователем — такие
// связки (и с невалидным GUID) возвращаются в skipped.
func (s *UserStorage) UserADLinkBatch(ctx context.Context, links []models.ADLink) (int64, []models.ADLink, error) {
	var (
		linked  int64
		skipped []models.ADLink
	)
	for _, l := range links {
		guid, err := uuid.Parse(l.ADObjectID)
		if err != nil {
			skipped = append(skipped, l)
			continue
		}
		res := s.db.WithContext(ctx).Exec(`
			UPDATE users SET ad_object_id = ?, updated_at = now()
			WHERE id = ?
			  AND (ad_object_id IS NULL OR ad_object_id = ?)
			  AND NOT EXISTS (SELECT 1 FROM users x WHERE x.ad_object_id = ? AND x.id <> ?)`,
			guid, l.UserID, guid, guid, l.UserID)
		if res.Error != nil {
			return linked, skipped, res.Error
		}
		if res.RowsAffected == 0 {
			skipped = append(skipped, l)
			continue
		}
		linked++
	}
	return linked, skipped, nil
}

// UserPermissionsSet приводит права пользователя ровно к набору perms (как
// UserRolesSet: лишние удаляет, недостающие добавляет).
func (s *UserStorage) UserPermissionsSet(ctx context.Context, userID int64, perms []string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&models.User{}).Where("id = ?", userID).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return models.ErrUserNotFound
		}

		del := tx.Where("user_id = ?", userID)
		if len(perms) > 0 {
			del = del.Where("permission NOT IN ?", perms)
		}
		if err := del.Delete(&models.UserPermission{}).Error; err != nil {
			return err
		}
		if len(perms) == 0 {
			return nil
		}

		rows := make([]models.UserPermission, 0, len(perms))
		for _, p := range perms {
			rows = append(rows, models.UserPermission{UserID: userID, Permission: p})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
}

// withDepartmentGroups подставляет людям доступы их подразделений
// (access_group_departments) — двумя запросами на всех, не на каждого.
func withDepartmentGroups(db *gorm.DB, users ...*models.User) error {
	var deps []enum.UserEmployeeDepartment
	for _, u := range users {
		deps = append(deps, u.DepartmentList()...)
	}
	deps = models.NormalizeDepartments(deps)
	if len(deps) == 0 {
		return nil
	}

	var links []models.AccessGroupDepartment
	if err := db.Where("department IN ?", deps).Find(&links).Error; err != nil {
		return err
	}
	if len(links) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(links))
	for _, l := range links {
		ids = append(ids, l.GroupID)
	}
	var groups []models.AccessGroup
	if err := db.Preload("Permissions").Where("id IN ?", ids).Find(&groups).Error; err != nil {
		return err
	}
	byID := make(map[int64]models.AccessGroup, len(groups))
	for _, g := range groups {
		byID[g.ID] = g
	}
	byDept := make(map[enum.UserEmployeeDepartment][]int64)
	for _, l := range links {
		byDept[l.Department] = append(byDept[l.Department], l.GroupID)
	}

	for _, u := range users {
		seen := map[int64]bool{}
		for _, d := range u.DepartmentList() {
			for _, id := range byDept[d] {
				if g, ok := byID[id]; ok && !seen[id] {
					seen[id] = true
					u.DepartmentGroups = append(u.DepartmentGroups, g)
				}
			}
		}
	}
	return nil
}
