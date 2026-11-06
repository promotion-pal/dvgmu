package storage

import (
	"context"
	"errors"
	"strings"
	"time"

	"dvgmu/api/internal/domain/models"
	enum "fesmu/contract/fesmu/enum/v1"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TestStorage struct {
	db *gorm.DB
}

func TestStorageNew(db *gorm.DB) *TestStorage {
	return &TestStorage{db: db}
}

func withQuestions(q *gorm.DB) *gorm.DB {
	return q.
		Preload("Questions", func(db *gorm.DB) *gorm.DB { return db.Order("position") }).
		Preload("Questions.Answers", func(db *gorm.DB) *gorm.DB { return db.Order("position") }).
		Preload("Questions.AnswersV2", func(db *gorm.DB) *gorm.DB { return db.Order("position") })
}

func (s *TestStorage) TestFetch(ctx context.Context, filter models.TestFilter) ([]*models.Test, error) {
	q := s.db.WithContext(ctx).Model(&models.Test{})
	if topic := strings.TrimSpace(filter.Topic); topic != "" {
		q = q.Where("topic ILIKE ?", "%"+escapeLike(topic)+"%")
	}

	var records []*models.Test
	if err := withQuestions(q).Order("department, discipline, topic, id").Find(&records).Error; err != nil {
		return nil, err
	}
	for _, r := range records {
		r.LoadAnswers()
	}
	return records, nil
}

func (s *TestStorage) TestByID(ctx context.Context, id int64) (*models.Test, error) {
	var record models.Test
	err := withQuestions(s.db.WithContext(ctx)).First(&record, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, models.ErrTestNotFound
	}
	if err != nil {
		return nil, err
	}
	record.LoadAnswers()
	return &record, nil
}

func (s *TestStorage) TestCreate(ctx context.Context, test *models.Test) (int64, error) {
	test.StoreAnswers()
	defer test.LoadAnswers()
	if err := s.db.WithContext(ctx).Create(test).Error; err != nil {
		return 0, err
	}
	return test.ID, nil
}

// TestUpdate replaces the test's fields and questions. Its version stays
// the one it was created with: V1 and V2 tests never turn into each other.
func (s *TestStorage) TestUpdate(ctx context.Context, test *models.Test) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var stored models.Test
		err := tx.Select("id", "version").Clauses(clause.Locking{Strength: "UPDATE"}).First(&stored, "id = ?", test.ID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.ErrTestNotFound
		}
		if err != nil {
			return err
		}
		test.Version = stored.Version
		test.StoreAnswers()
		defer test.LoadAnswers()

		res := tx.Model(&models.Test{}).Where("id = ?", test.ID).
			Select("department", "discipline", "semester", "topic", "description", "updated_at").
			Updates(test)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return models.ErrTestNotFound
		}

		if err := tx.Where("test_id = ?", test.ID).Delete(&models.TestQuestion{}).Error; err != nil {
			return err
		}
		for i := range test.Questions {
			test.Questions[i].TestID = test.ID
		}
		return tx.Create(&test.Questions).Error
	})
}

func (s *TestStorage) TestExportStatusUpdate(ctx context.Context, id int64, status enum.TestExportStatus) error {
	res := s.db.WithContext(ctx).Model(&models.Test{}).Where("id = ?", id).
		Updates(map[string]any{"export_status": status, "updated_at": time.Now()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrTestNotFound
	}
	return nil
}

func (s *TestStorage) TestDelete(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&models.Test{}, "id = ?", id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return models.ErrTestNotFound
	}
	return nil
}

// TestImageSave registers a stored picture; one already there (the same hash) is kept.
func (s *TestStorage) TestImageSave(ctx context.Context, img *models.TestImage) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(img).Error
}

// TestImages: the registered pictures among hashes, by hash.
func (s *TestStorage) TestImages(ctx context.Context, hashes []string) (map[string]*models.TestImage, error) {
	out := map[string]*models.TestImage{}
	if len(hashes) == 0 {
		return out, nil
	}
	var records []*models.TestImage
	if err := s.db.WithContext(ctx).Where("hash IN ?", hashes).Find(&records).Error; err != nil {
		return nil, err
	}
	for _, r := range records {
		out[r.Hash] = r
	}
	return out, nil
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}
