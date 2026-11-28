package storage

import (
	"context"
	"slices"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"dvgmu/schedula/internal/domain/models"
	scheduleenum "fesmu/contract/schedula/enum"
)

type Storage struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Storage {
	return &Storage{db: db}
}

func (s *Storage) Write(ctx context.Context, fn func(*Storage) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(731445253)").Error; err != nil {
			return err
		}
		return fn(New(tx))
	})
}

func (s *Storage) Event(ctx context.Context, id string) (models.Event, error) {
	var event models.Event
	err := s.events(ctx).Take(&event, "events.id = ?", id).Error
	return event, err
}

func (s *Storage) Events(ctx context.Context, from, to time.Time, drafts bool) ([]models.Event, error) {
	var events []models.Event
	query := s.events(ctx).Where(`(events.status = ? OR NOT EXISTS (SELECT 1 FROM holidays WHERE holidays.date = events.date))`,
		scheduleenum.EventStatus_EVENT_STATUS_CANCELLED)
	if drafts {
		query = query.Where("(events.date BETWEEN ? AND ? OR (events.date IS NULL AND events.status = ?))", from, to, scheduleenum.EventStatus_EVENT_STATUS_DRAFT)
	} else {
		query = query.Where("events.date BETWEEN ? AND ? AND events.status IN ?", from, to, []scheduleenum.EventStatus{
			scheduleenum.EventStatus_EVENT_STATUS_PUBLISHED, scheduleenum.EventStatus_EVENT_STATUS_CANCELLED,
		})
	}
	err := query.Find(&events).Error
	return events, err
}

func (s *Storage) Transfers(ctx context.Context, from, to time.Time, drafts bool) ([]models.Event, error) {
	var events []models.Event
	statuses := []scheduleenum.EventStatus{scheduleenum.EventStatus_EVENT_STATUS_PUBLISHED}
	if drafts {
		statuses = append(statuses, scheduleenum.EventStatus_EVENT_STATUS_DRAFT)
	}
	err := s.events(ctx).
		Joins("JOIN holidays ON holidays.date = events.date").
		Joins("JOIN terms ON terms.id = events.term_id").
		Where("terms.date_from <= ? AND terms.date_to >= ? AND events.status IN ?", to, from, statuses).
		Find(&events).Error
	return events, err
}

func (s *Storage) Series(ctx context.Context, id string) ([]models.Event, error) {
	var events []models.Event
	err := s.events(ctx).Where("events.series_id = ? AND events.status = ?", id, scheduleenum.EventStatus_EVENT_STATUS_DRAFT).
		Find(&events).Error
	return events, err
}

func (s *Storage) OccupiedEvents(ctx context.Context, dates []time.Time, drafts bool) ([]models.Event, error) {
	if len(dates) == 0 {
		return nil, nil
	}
	statuses := []scheduleenum.EventStatus{scheduleenum.EventStatus_EVENT_STATUS_PUBLISHED}
	if drafts {
		statuses = append(statuses, scheduleenum.EventStatus_EVENT_STATUS_DRAFT)
	}
	var events []models.Event
	err := s.events(ctx).Where("events.date IN ? AND events.start_minute IS NOT NULL AND events.status IN ?", dates, statuses).Find(&events).Error
	return events, err
}

func (s *Storage) TermEvents(ctx context.Context, term models.Term) ([]models.Event, error) {
	var events []models.Event
	err := s.events(ctx).Where("(events.date BETWEEN ? AND ? OR events.date IS NULL)", term.DateFrom, term.DateTo).
		Where("events.term_id = ? AND events.status IN ?", term.ID, []scheduleenum.EventStatus{
			scheduleenum.EventStatus_EVENT_STATUS_DRAFT, scheduleenum.EventStatus_EVENT_STATUS_PUBLISHED,
		}).Find(&events).Error
	return events, err
}

func (s *Storage) events(ctx context.Context) *gorm.DB {
	return s.db.WithContext(ctx).Model(&models.Event{}).Joins("Subject").Joins("Room.Site").Order("events.date, events.start_minute, events.id")
}

func (s *Storage) InsertEvents(ctx context.Context, events []models.Event) error {
	return s.db.WithContext(ctx).Omit("Subject", "Room").CreateInBatches(&events, 100).Error
}

func (s *Storage) UpdateEvent(ctx context.Context, event *models.Event) error {
	return s.db.WithContext(ctx).Omit("Subject", "Room").Select("*").Updates(event).Error
}

func (s *Storage) PublishEvents(ctx context.Context, ids []string) error {
	result := s.db.WithContext(ctx).Model(&models.Event{}).
		Where("id IN ? AND status = ?", ids, scheduleenum.EventStatus_EVENT_STATUS_DRAFT).
		Updates(map[string]any{
			"revision":   gorm.Expr("revision + 1"),
			"status":     scheduleenum.EventStatus_EVENT_STATUS_PUBLISHED,
			"updated_at": time.Now(),
		})
	if result.Error == nil && result.RowsAffected != int64(len(ids)) {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

func (s *Storage) Term(ctx context.Context, id string) (models.Term, error) {
	var term models.Term
	err := s.db.WithContext(ctx).Take(&term, "id = ?", id).Error
	return term, err
}

func (s *Storage) FirstTermInRange(ctx context.Context, from, to time.Time) (models.Term, error) {
	var term models.Term
	err := s.db.WithContext(ctx).Where("date_from <= ? AND date_to >= ?", to, from).Order("date_from").Limit(1).Find(&term).Error
	return term, err
}

func (s *Storage) Periods(ctx context.Context, from, to time.Time) ([]models.AcademicPeriod, error) {
	var periods []models.AcademicPeriod
	err := s.db.WithContext(ctx).Where("date_from <= ? AND date_to >= ?", to, from).Order("date_from, id").Find(&periods).Error
	return periods, err
}

func (s *Storage) Holidays(ctx context.Context, from, to time.Time) ([]models.Holiday, error) {
	var holidays []models.Holiday
	err := s.db.WithContext(ctx).Where("date BETWEEN ? AND ?", from, to).Find(&holidays).Error
	return holidays, err
}

func (s *Storage) Availability(ctx context.Context, dates []time.Time) (Catalog, error) {
	var c Catalog
	if len(dates) == 0 {
		return c, nil
	}
	db := s.db.WithContext(ctx)
	if err := db.Where("date IN ?", dates).Find(&c.Holidays).Error; err != nil {
		return c, err
	}
	if err := db.Find(&c.TravelTimes).Error; err != nil {
		return c, err
	}
	periods, err := s.Periods(ctx, slices.MinFunc(dates, time.Time.Compare), slices.MaxFunc(dates, time.Time.Compare))
	if err != nil {
		return c, err
	}
	c.Periods = periods
	err = db.Where("NOT cancelled AND date IN ?", dates).Order("date, start_minute, id").Find(&c.Bookings).Error
	return c, err
}

type Catalog struct {
	Terms       []models.Term
	Subjects    []models.Subject
	Sites       []models.Site
	Rooms       []models.Room
	Periods     []models.AcademicPeriod
	Holidays    []models.Holiday
	TravelTimes []models.TravelTime
	Bookings    []models.Booking
}

func (s *Storage) Catalog(ctx context.Context, detailed bool) (Catalog, error) {
	var c Catalog
	db := s.db.WithContext(ctx)
	if err := db.Order("date_from").Find(&c.Terms).Error; err != nil {
		return c, err
	}
	if err := db.Order("name, id").Find(&c.Subjects).Error; err != nil {
		return c, err
	}
	if err := db.Order("name, id").Find(&c.Sites).Error; err != nil {
		return c, err
	}
	if err := db.Joins("Site").Order("rooms.name, rooms.id").Find(&c.Rooms).Error; err != nil {
		return c, err
	}
	if !detailed {
		return c, nil
	}
	if err := db.Order("date_from, id").Find(&c.Periods).Error; err != nil {
		return c, err
	}
	if err := db.Order("date").Find(&c.Holidays).Error; err != nil {
		return c, err
	}
	if err := db.Order("from_site_id, to_site_id").Find(&c.TravelTimes).Error; err != nil {
		return c, err
	}
	err := db.Order("date, start_minute, id").Find(&c.Bookings).Error
	return c, err
}

func (s *Storage) SaveCatalog(ctx context.Context, c Catalog) error {
	db := s.db.WithContext(ctx)
	if err := insertCatalog(db, c.Terms); err != nil {
		return err
	}
	if err := insertCatalog(db, c.Subjects); err != nil {
		return err
	}
	if err := insertCatalog(db, c.Sites); err != nil {
		return err
	}
	if err := insertCatalog(db.Omit("Site"), c.Rooms); err != nil {
		return err
	}
	if err := insertCatalog(db, c.Periods); err != nil {
		return err
	}
	if err := insertCatalog(db, c.Holidays); err != nil {
		return err
	}
	if err := insertCatalog(db, c.TravelTimes); err != nil {
		return err
	}
	return insertCatalog(db, c.Bookings)
}

func insertCatalog[T any](db *gorm.DB, rows []T) error {
	if len(rows) == 0 {
		return nil
	}
	return db.Clauses(clause.OnConflict{UpdateAll: true}).CreateInBatches(&rows, 100).Error
}

func (s *Storage) Change(ctx context.Context, id string) (models.Change, error) {
	var change models.Change
	err := s.db.WithContext(ctx).First(&change, "id = ?", id).Error
	return change, err
}

func (s *Storage) PendingChange(ctx context.Context, eventID string) (bool, error) {
	var exists bool
	err := s.db.WithContext(ctx).Raw("SELECT EXISTS (SELECT 1 FROM changes WHERE event_id = ? AND status = ?)",
		eventID, scheduleenum.ChangeStatus_CHANGE_STATUS_PENDING).Scan(&exists).Error
	return exists, err
}

func (s *Storage) Changes(ctx context.Context, eventID string, authorID *string) ([]models.Change, error) {
	var changes []models.Change
	query := s.db.WithContext(ctx).Where("event_id = ?", eventID)
	if authorID != nil {
		query = query.Where("author_id = ?", *authorID)
	}
	err := query.Order("submitted_at, id").Find(&changes).Error
	return changes, err
}

func (s *Storage) InsertChange(ctx context.Context, change *models.Change) error {
	return s.db.WithContext(ctx).Create(change).Error
}

func (s *Storage) DecideChange(ctx context.Context, change *models.Change) error {
	return s.db.WithContext(ctx).Select("Status", "ReviewerID", "DecidedAt", "Decision").Updates(change).Error
}

func (s *Storage) ValidateTerm(ctx context.Context, term models.Term) error {
	var count int64
	err := s.db.WithContext(ctx).Model(&models.Event{}).
		Where("term_id = ? AND (date < ? OR date > ?)", term.ID, term.DateFrom, term.DateTo).Count(&count).Error
	if err != nil {
		return err
	}
	if count > 0 {
		return gorm.ErrForeignKeyViolated
	}
	return nil
}
