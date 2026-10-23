package library

import (
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	enum "fesmu/contract/fesmu/enum/v2"
)

// storage reads and writes library_db. Inside tx, db is the transaction.
type storage struct {
	db *gorm.DB
}

// manualListColumns leave the content out: lists show only the card.
const manualListColumns = "id, discipline, title, specialty, course, semester, authors, annotation, status, draft_changed, updated_by, created_at, updated_at, published_at"

func (s *storage) tx(ctx context.Context, fn func(tx *storage) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&storage{db: tx})
	})
}

// like is an ILIKE pattern for a search typed on the page.
func like(q string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(strings.TrimSpace(q)) + "%"
}

func (s *storage) items(ctx context.Context, query, discipline string) ([]*Item, error) {
	q := s.db.WithContext(ctx).Preload("File").Order("title, id")
	if discipline != "" {
		q = q.Where("discipline = ?", discipline)
	}
	if strings.TrimSpace(query) != "" {
		p := like(query)
		q = q.Where("title ILIKE ? OR authors ILIKE ? OR description ILIKE ?", p, p, p)
	}
	var list []*Item
	return list, q.Find(&list).Error
}

func (s *storage) itemsByID(ctx context.Context, ids []int64) ([]*Item, error) {
	var list []*Item
	if len(ids) == 0 {
		return list, nil
	}
	return list, s.db.WithContext(ctx).Preload("File").Where("id IN ?", ids).Order("title, id").Find(&list).Error
}

func (s *storage) item(ctx context.Context, id int64) (*Item, error) {
	var it Item
	err := s.db.WithContext(ctx).Preload("File").First(&it, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("издание не найдено")
	}
	return &it, err
}

func (s *storage) itemSave(ctx context.Context, it *Item) error {
	return s.db.WithContext(ctx).Omit("File").Save(it).Error
}

func (s *storage) itemDelete(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&Item{}, "id = ?", id).Error
}

func (s *storage) fileCreate(ctx context.Context, f *File) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(f).Error
}

func (s *storage) fileDelete(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&File{}, "id = ?", id).Error
}

func (s *storage) file(ctx context.Context, id int64) (*File, error) {
	var f File
	err := s.db.WithContext(ctx).First(&f, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("файл не найден")
	}
	return &f, err
}

func (s *storage) filesByID(ctx context.Context, ids []int64) (map[int64]*File, error) {
	out := map[int64]*File{}
	if len(ids) == 0 {
		return out, nil
	}
	var list []*File
	if err := s.db.WithContext(ctx).Where("id IN ?", ids).Find(&list).Error; err != nil {
		return nil, err
	}
	for _, f := range list {
		out[f.ID] = f
	}
	return out, nil
}

func (s *storage) existingItemIDs(ctx context.Context, ids []int64) (map[int64]bool, error) {
	out := map[int64]bool{}
	if len(ids) == 0 {
		return out, nil
	}
	var found []int64
	if err := s.db.WithContext(ctx).Model(&Item{}).Where("id IN ?", ids).Pluck("id", &found).Error; err != nil {
		return nil, err
	}
	for _, id := range found {
		out[id] = true
	}
	return out, nil
}

// disciplines named anywhere in the catalog or manuals.
func (s *storage) disciplines(ctx context.Context) ([]string, error) {
	var list []string
	err := s.db.WithContext(ctx).Raw(`
		SELECT discipline FROM library_items WHERE discipline <> ''
		UNION
		SELECT discipline FROM library_manuals WHERE discipline <> ''
		ORDER BY 1`).Scan(&list).Error
	return list, err
}

// manuals lists cards; published only for readers, everything for editors.
func (s *storage) manuals(ctx context.Context, discipline, query string, publishedOnly bool) ([]*Manual, error) {
	q := s.db.WithContext(ctx).Select(manualListColumns).Order("discipline, title, id")
	if publishedOnly {
		q = q.Where("status = ?", enum.ManualStatus_MANUAL_STATUS_PUBLISHED)
	}
	if discipline != "" {
		q = q.Where("discipline = ?", discipline)
	}
	if strings.TrimSpace(query) != "" {
		p := like(query)
		q = q.Where("title ILIKE ? OR authors ILIKE ? OR annotation ILIKE ?", p, p, p)
	}
	var list []*Manual
	return list, q.Find(&list).Error
}

func (s *storage) manual(ctx context.Context, id int64) (*Manual, error) {
	var m Manual
	err := s.db.WithContext(ctx).First(&m, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("методичка не найдена")
	}
	return &m, err
}

func (s *storage) manualLocked(ctx context.Context, id int64) (*Manual, error) {
	var m Manual
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&m, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("методичка не найдена")
	}
	return &m, err
}

func (s *storage) manualSave(ctx context.Context, m *Manual) error {
	return s.db.WithContext(ctx).Save(m).Error
}

func (s *storage) manualDelete(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&Manual{}, "id = ?", id).Error
}

// titles of what reading positions point at, by kind and id.
func (s *storage) titles(ctx context.Context, kind enum.ReaderSourceKind, ids []int64) (map[int64]string, error) {
	out := map[int64]string{}
	if len(ids) == 0 {
		return out, nil
	}
	type row struct {
		ID    int64
		Title string
	}
	var rows []row
	var model any = &Item{}
	if kind == enum.ReaderSourceKind_READER_SOURCE_KIND_MANUAL {
		model = &Manual{}
	}
	if err := s.db.WithContext(ctx).Model(model).Select("id, title").Where("id IN ?", ids).Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ID] = r.Title
	}
	return out, nil
}

func (s *storage) progress(ctx context.Context, user string, kind enum.ReaderSourceKind, refID int64, limit int) ([]*Progress, error) {
	q := s.db.WithContext(ctx).Where("user_uuid = ?", user).Order("updated_at DESC")
	if refID > 0 {
		q = q.Where("kind = ? AND ref_id = ?", kind, refID)
	}
	var list []*Progress
	return list, q.Limit(limit).Find(&list).Error
}

func (s *storage) progressSave(ctx context.Context, p *Progress) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_uuid"}, {Name: "kind"}, {Name: "ref_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"position", "percent", "updated_at"}),
	}).Create(p).Error
}
