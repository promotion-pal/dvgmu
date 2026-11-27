package storage

import (
	"errors"
	"os"
	"testing"
	"time"

	"dvgmu/api/internal/domain/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestScheduleUpdateUsesStoredVersion(t *testing.T) {
	dsn := os.Getenv("SCHEDULA_TEST_DSN")
	if dsn == "" {
		t.Skip("SCHEDULA_TEST_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	conn, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	tx := db.Begin()
	if tx.Error != nil {
		t.Fatal(tx.Error)
	}
	t.Cleanup(func() { tx.Rollback() })
	if err := tx.Exec(`CREATE TEMP TABLE schedule_timetables (
		id text PRIMARY KEY, program_id text, course integer, title text, semester_start text,
		body jsonb, created_at timestamptz, updated_at timestamptz
	) ON COMMIT DROP`).Error; err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()
	store := ScheduleStorageNew(tx)
	version := time.Date(2026, 9, 1, 0, 0, 0, 123456000, time.UTC)
	schedule := &models.Schedule{ID: "test", Body: `{}`, Title: "Начальное", CreatedAt: version, UpdatedAt: version}
	if _, err := store.ScheduleCreate(ctx, schedule); err != nil {
		t.Fatal(err)
	}
	schedule.Title, schedule.Body = "Первое изменение", `{"course":1}`
	if err := store.ScheduleUpdate(ctx, schedule, version); err != nil {
		t.Fatal(err)
	}
	schedule.Title = "Устаревшее изменение"
	if err := store.ScheduleUpdate(ctx, schedule, version); !errors.Is(err, models.ErrScheduleStale) {
		t.Fatalf("expected stale version, got %v", err)
	}
	current, err := store.ScheduleByID(ctx, schedule.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Title != "Первое изменение" || !current.UpdatedAt.After(version) || !current.CreatedAt.Equal(version) {
		t.Fatalf("unexpected persisted version: %+v", current)
	}
	if err := store.ScheduleUpdate(ctx, schedule, current.UpdatedAt); err != nil {
		t.Fatal(err)
	}
	schedule.ID = "missing"
	if err := store.ScheduleUpdate(ctx, schedule, version); !errors.Is(err, models.ErrScheduleNotFound) {
		t.Fatalf("expected missing schedule, got %v", err)
	}
}
