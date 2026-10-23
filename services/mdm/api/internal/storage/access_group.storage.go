package storage

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"dvgmu/api/contract/gen/go/enum"
	"dvgmu/api/internal/domain/models"
)

type AccessGroupStorage struct {
	db *gorm.DB
}

func AccessGroupStorageNew(db *gorm.DB) *AccessGroupStorage {
	return &AccessGroupStorage{db: db}
}

// userCount — сколько людей с набором, для списка наборов.
const accessGroupUserCount = "(SELECT count(*) FROM user_access_groups u WHERE u.group_id = access_groups.id) AS user_count"

func (s *AccessGroupStorage) AccessGroupFetch(ctx context.Context) ([]*models.AccessGroup, error) {
	var records []*models.AccessGroup
	err := s.db.WithContext(ctx).
		Select("access_groups.*", accessGroupUserCount).
		Preload("Permissions").Preload("Departments").
		Order("name").
		Find(&records).Error
	return records, err
}

func (s *AccessGroupStorage) AccessGroupByID(ctx context.Context, id int64) (*models.AccessGroup, error) {
	var record models.AccessGroup
	err := s.db.WithContext(ctx).
		Select("access_groups.*", accessGroupUserCount).
		Preload("Permissions").Preload("Departments").
		First(&record, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrAccessGroupNotFound
	}
	return &record, err
}

// AccessGroupSave создаёт (ID = 0) или меняет набор и приводит его права
// ровно к perms. Возвращает id набора.
func (s *AccessGroupStorage) AccessGroupSave(ctx context.Context, g *models.AccessGroup, perms []string, deps []enum.UserEmployeeDepartment) (int64, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var taken int64
		if err := tx.Model(&models.AccessGroup{}).
			Where("lower(name) = lower(?) AND id <> ?", g.Name, g.ID).
			Count(&taken).Error; err != nil {
			return err
		}
		if taken > 0 {
			return models.ErrAccessGroupExists
		}

		if g.ID == 0 {
			if err := tx.Omit("Permissions", "Departments", "UserCount").Create(g).Error; err != nil {
				return err
			}
		} else {
			res := tx.Model(&models.AccessGroup{}).Where("id = ?", g.ID).
				Updates(map[string]any{"name": g.Name, "description": g.Description, "updated_at": gorm.Expr("now()")})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return models.ErrAccessGroupNotFound
			}
		}

		if err := setGroupDepartments(tx, g.ID, deps); err != nil {
			return err
		}

		del := tx.Where("group_id = ?", g.ID)
		if len(perms) > 0 {
			del = del.Where("permission NOT IN ?", perms)
		}
		if err := del.Delete(&models.AccessGroupPermission{}).Error; err != nil {
			return err
		}
		if len(perms) == 0 {
			return nil
		}
		rows := make([]models.AccessGroupPermission, 0, len(perms))
		for _, p := range perms {
			rows = append(rows, models.AccessGroupPermission{GroupID: g.ID, Permission: p})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
	return g.ID, err
}

// AccessGroupDelete — набор и все его выдачи (каскадом).
func (s *AccessGroupStorage) AccessGroupDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.AccessGroup{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrAccessGroupNotFound
	}
	return nil
}

// UserAccessGroupsSet приводит наборы пользователя ровно к groupIDs.
func (s *AccessGroupStorage) UserAccessGroupsSet(ctx context.Context, userID int64, groupIDs []int64) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var exists int64
		if err := tx.Model(&models.User{}).Where("id = ?", userID).Count(&exists).Error; err != nil {
			return err
		}
		if exists == 0 {
			return models.ErrUserNotFound
		}
		if len(groupIDs) > 0 {
			var found int64
			if err := tx.Model(&models.AccessGroup{}).Where("id IN ?", groupIDs).Count(&found).Error; err != nil {
				return err
			}
			if found != int64(len(groupIDs)) {
				return models.ErrAccessGroupNotFound
			}
		}

		del := tx.Where("user_id = ?", userID)
		if len(groupIDs) > 0 {
			del = del.Where("group_id NOT IN ?", groupIDs)
		}
		if err := del.Delete(&models.UserAccessGroup{}).Error; err != nil {
			return err
		}
		if len(groupIDs) == 0 {
			return nil
		}
		rows := make([]models.UserAccessGroup, 0, len(groupIDs))
		for _, id := range groupIDs {
			rows = append(rows, models.UserAccessGroup{UserID: userID, GroupID: id})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
}

// setGroupDepartments приводит подразделения доступа ровно к deps.
func setGroupDepartments(tx *gorm.DB, groupID int64, deps []enum.UserEmployeeDepartment) error {
	del := tx.Where("group_id = ?", groupID)
	if len(deps) > 0 {
		del = del.Where("department NOT IN ?", deps)
	}
	if err := del.Delete(&models.AccessGroupDepartment{}).Error; err != nil {
		return err
	}
	if len(deps) == 0 {
		return nil
	}
	rows := make([]models.AccessGroupDepartment, 0, len(deps))
	for _, d := range deps {
		rows = append(rows, models.AccessGroupDepartment{GroupID: groupID, Department: d})
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}
