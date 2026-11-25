package storage

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"dvgmu/api/internal/domain/models"
)

type UserPermissionGroupStorage struct {
	db *gorm.DB
}

func UserPermissionGroupStorageNew(db *gorm.DB) *UserPermissionGroupStorage {
	return &UserPermissionGroupStorage{db: db}
}

func (s *UserPermissionGroupStorage) UserPermissionGroupFetch(ctx context.Context) ([]*models.UserPermissionGroup, error) {
	var records []*models.UserPermissionGroup
	err := s.db.WithContext(ctx).
		Preload("Permissions").
		Order("name").
		Find(&records).Error
	return records, err
}

func (s *UserPermissionGroupStorage) UserPermissionGroupAssignmentsFetch(ctx context.Context) ([]*models.UserPermissionGroupAssignment, error) {
	var records []*models.UserPermissionGroupAssignment
	err := s.db.WithContext(ctx).Order("user_id, group_id").Find(&records).Error
	return records, err
}

func (s *UserPermissionGroupStorage) UserPermissionGroupByID(ctx context.Context, id int64) (*models.UserPermissionGroup, error) {
	var record models.UserPermissionGroup
	err := s.db.WithContext(ctx).
		Preload("Permissions").
		First(&record, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrUserPermissionGroupNotFound
	}
	return &record, err
}

// UserPermissionGroupSave создаёт (ID = 0) или меняет набор и приводит его права
// ровно к perms. Возвращает id набора.
func (s *UserPermissionGroupStorage) UserPermissionGroupSave(ctx context.Context, g *models.UserPermissionGroup, perms []string) (int64, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var taken int64
		if err := tx.Model(&models.UserPermissionGroup{}).
			Where("lower(name) = lower(?) AND id <> ?", g.Name, g.ID).
			Count(&taken).Error; err != nil {
			return err
		}
		if taken > 0 {
			return models.ErrUserPermissionGroupExists
		}

		if g.ID == 0 {
			if err := tx.Omit("Permissions").Create(g).Error; err != nil {
				return err
			}
		} else {
			res := tx.Model(&models.UserPermissionGroup{}).Where("id = ?", g.ID).
				Updates(map[string]any{"name": g.Name, "description": g.Description, "updated_at": gorm.Expr("now()")})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return models.ErrUserPermissionGroupNotFound
			}
		}

		del := tx.Where("group_id = ?", g.ID)
		if len(perms) > 0 {
			del = del.Where("permission NOT IN ?", perms)
		}
		if err := del.Delete(&models.UserPermissionGroupPermission{}).Error; err != nil {
			return err
		}
		if len(perms) == 0 {
			return nil
		}
		rows := make([]models.UserPermissionGroupPermission, 0, len(perms))
		for _, p := range perms {
			rows = append(rows, models.UserPermissionGroupPermission{GroupID: g.ID, Permission: p})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
	return g.ID, err
}

// UserPermissionGroupDelete — набор и все его выдачи (каскадом).
func (s *UserPermissionGroupStorage) UserPermissionGroupDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.UserPermissionGroup{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrUserPermissionGroupNotFound
	}
	return nil
}

// UserPermissionGroupsSet приводит наборы пользователя ровно к groupIDs.
func (s *UserPermissionGroupStorage) UserPermissionGroupsSet(ctx context.Context, userID int64, groupIDs []int64) error {
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
			if err := tx.Model(&models.UserPermissionGroup{}).Where("id IN ?", groupIDs).Count(&found).Error; err != nil {
				return err
			}
			if found != int64(len(groupIDs)) {
				return models.ErrUserPermissionGroupNotFound
			}
		}

		del := tx.Where("user_id = ?", userID)
		if len(groupIDs) > 0 {
			del = del.Where("group_id NOT IN ?", groupIDs)
		}
		if err := del.Delete(&models.UserPermissionGroupAssignment{}).Error; err != nil {
			return err
		}
		if len(groupIDs) == 0 {
			return nil
		}
		rows := make([]models.UserPermissionGroupAssignment, 0, len(groupIDs))
		for _, id := range groupIDs {
			rows = append(rows, models.UserPermissionGroupAssignment{UserID: userID, GroupID: id})
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
}
