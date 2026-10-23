package storage

import (
	"context"
	"errors"

	"dvgmu/api/internal/domain/models"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type VaccinationStorage struct {
	db *gorm.DB
}

func VaccinationStorageNew(db *gorm.DB) *VaccinationStorage {
	return &VaccinationStorage{db: db}
}

// VaccinationDayFetch returns days from dateFrom on (all when empty), each
// with its slots in time order and every slot's sign-ups in sign-up order.
func (s *VaccinationStorage) VaccinationDayFetch(ctx context.Context, dateFrom string) ([]*models.VaccinationDay, error) {
	q := s.db.WithContext(ctx).
		Preload("Slots", func(db *gorm.DB) *gorm.DB { return db.Order("time_start") }).
		Preload("Slots.Signups", func(db *gorm.DB) *gorm.DB { return db.Order("created_at, id") })
	if dateFrom != "" {
		q = q.Where("date >= ?", dateFrom)
	}

	var days []*models.VaccinationDay
	if err := q.Order("date, id").Find(&days).Error; err != nil {
		return nil, err
	}
	return days, nil
}

func (s *VaccinationStorage) VaccinationDayCreate(ctx context.Context, day *models.VaccinationDay) (int64, error) {
	if err := s.db.WithContext(ctx).Create(day).Error; err != nil {
		return 0, err
	}
	return day.ID, nil
}

func (s *VaccinationStorage) VaccinationDayDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.VaccinationDay{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrVaccinationDayNotFound
	}
	return nil
}

// VaccinationSignupCreate puts a person on a slot's list if there's a place
// left and they aren't on that day's list yet. The slot row is locked for the
// check-and-insert, so two people can't both take the last place.
func (s *VaccinationStorage) VaccinationSignupCreate(ctx context.Context, signup *models.VaccinationSignup, today string) (int64, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var slot models.VaccinationSlot
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&slot, "id = ?", signup.SlotID).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return models.ErrVaccinationSlotNotFound
			}
			return err
		}

		var day models.VaccinationDay
		if err := tx.First(&day, "id = ?", slot.DayID).Error; err != nil {
			return err
		}
		if day.Date < today {
			return models.ErrVaccinationSlotNotFound
		}

		var taken int64
		if err := tx.Model(&models.VaccinationSignup{}).Where("slot_id = ?", slot.ID).Count(&taken).Error; err != nil {
			return err
		}
		if taken >= int64(slot.Capacity) {
			return models.ErrVaccinationSlotFull
		}

		var same int64
		err = tx.Model(&models.VaccinationSignup{}).Where("day_id = ? AND name_key = ?", slot.DayID, signup.NameKey).Count(&same).Error
		if err != nil {
			return err
		}
		if same > 0 {
			return models.ErrVaccinationAlreadySignedUp
		}

		signup.DayID = slot.DayID
		return tx.Create(signup).Error
	})
	if err != nil {
		// The unique (day, name) index backs the check above when two
		// requests for the same name land on different slots at once.
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return 0, models.ErrVaccinationAlreadySignedUp
		}
		return 0, err
	}
	return signup.ID, nil
}

func (s *VaccinationStorage) VaccinationSignupDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.VaccinationSignup{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrVaccinationSignupNotFound
	}
	return nil
}
