package storage

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"dvgmu/auth/internal/domain/models"
	"dvgmu/auth/internal/utils"
)

type IdentityStorage struct {
	db  *gorm.DB
	log *slog.Logger
}

func IdentityStorageNew(db *gorm.DB, log *slog.Logger) *IdentityStorage {
	return &IdentityStorage{db: db, log: log}
}

func (s *IdentityStorage) Migrate() error {
	return s.db.AutoMigrate(&models.Identity{})
}

func (s *IdentityStorage) IdentityUpsertLogin(ctx context.Context, objectGUID, login, email string) error {
	row := models.Identity{ObjectGUID: objectGUID, Login: login, Email: email, SyncedAt: time.Now()}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "object_guid"}},
		DoUpdates: clause.AssignmentColumns([]string{"login", "email", "synced_at", "updated_at"}),
	}).Create(&row).Error
}

func (s *IdentityStorage) IdentityLinkMDMBatch(ctx context.Context, links []models.MDMLink) error {
	if len(links) == 0 {
		return nil
	}

	byGUID := make(map[string]models.Identity, len(links))
	order := make([]string, 0, len(links))
	now := time.Now()
	for _, l := range links {
		guid, err := uuid.Parse(l.ObjectGUID)
		if err != nil || l.MDMID <= 0 {
			return utils.ErrInvalidLink
		}
		key := guid.String()
		if _, seen := byGUID[key]; !seen {
			order = append(order, key)
		}
		byGUID[key] = models.Identity{ObjectGUID: key, MDMID: l.MDMID, SyncedAt: now}
	}

	rows := make([]models.Identity, 0, len(order))
	for _, key := range order {
		rows = append(rows, byGUID[key])
	}

	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "object_guid"}},
		DoUpdates: clause.AssignmentColumns([]string{"mdm_id", "updated_at"}),
	}).CreateInBatches(&rows, 500).Error
}

func (s *IdentityStorage) IdentityFetch(ctx context.Context, filter models.IdentityFilter) ([]*models.Identity, int64, error) {
	query := s.db.WithContext(ctx).Model(&models.Identity{})

	if filter.MDMID > 0 {
		query = query.Where("mdm_id = ?", filter.MDMID)
	}
	if filter.ObjectGUID != "" {
		guid, err := uuid.Parse(filter.ObjectGUID)
		if err != nil {
			return []*models.Identity{}, 0, nil
		}
		query = query.Where("object_guid = ?", guid.String())
	}
	if filter.Email != "" {
		query = query.Where("email ILIKE ?", "%"+escapeLike(filter.Email)+"%")
	}
	if filter.Login != "" {
		query = query.Where("login ILIKE ?", "%"+escapeLike(filter.Login)+"%")
	}
	if filter.Linked != nil {
		if *filter.Linked {
			query = query.Where("mdm_id > 0")
		} else {
			query = query.Where("(mdm_id IS NULL OR mdm_id = 0)")
		}
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []*models.Identity
	err := query.
		Order("id ASC").
		Limit(filter.PageSize).
		Offset((filter.Page - 1) * filter.PageSize).
		Find(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *IdentityStorage) IdentityByID(ctx context.Context, id int64) (*models.Identity, error) {
	var row models.Identity
	if err := s.db.WithContext(ctx).First(&row, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrIdentityNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (s *IdentityStorage) IdentityByGUID(ctx context.Context, guid string) (*models.Identity, error) {
	if _, err := uuid.Parse(guid); err != nil {
		return nil, utils.ErrIdentityNotFound
	}

	var row models.Identity
	if err := s.db.WithContext(ctx).First(&row, "object_guid = ?", guid).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrIdentityNotFound
		}
		return nil, err
	}
	return &row, nil
}

func (s *IdentityStorage) IdentityByLogin(ctx context.Context, login string) (*models.Identity, error) {
	if login == "" {
		return nil, utils.ErrIdentityNotFound
	}

	var row models.Identity
	if err := s.db.WithContext(ctx).First(&row, "login = ?", login).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, utils.ErrIdentityNotFound
		}
		return nil, err
	}
	return &row, nil
}

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func escapeLike(s string) string {
	return likeEscaper.Replace(s)
}
