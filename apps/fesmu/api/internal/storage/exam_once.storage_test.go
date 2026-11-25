package storage

import (
	"context"
	api "dvgmu/api"
	"dvgmu/api/internal/domain/models"
	"errors"
	enum "fesmu/contract/fesmu/enum/v1"
	"github.com/google/uuid"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"os"
	"sync"
	"testing"
	"time"
)

func TestExamOncePostgresSessionScopedAttempts(t *testing.T) {
	dsn := os.Getenv("EXAM_TEST_DB_DSN")
	if dsn == "" {
		t.Skip("EXAM_TEST_DB_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sql, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sql.Close() })
	goose.SetBaseFS(api.MigrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(sql, "migrations/test"); err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	store := TestSessionStorageNew(db)
	student := uuid.NewString()
	other := uuid.NewString()
	now := time.Now().UTC()
	test := &models.Test{Department: "Once test", Discipline: uuid.NewString(), Semester: 1, Topic: "Exam", Version: enum.TestVersion_TEST_VERSION_V1, Questions: []models.TestQuestion{{Text: "Question", Answers: []models.TestAnswer{{Text: "Yes", IsCorrect: true}, {Text: "No"}}}}}
	if _, err := TestStorageNew(db).TestCreate(ctx, test); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Where("mdm_user_uuid IN ?", []string{student, other}).Delete(&models.ExamParticipation{})
		db.Where("test_id=?", test.ID).Delete(&models.TestSession{})
		db.Delete(test)
	})
	create := func() *models.TestSession {
		t.Helper()
		s, err := models.NewTestSession(test, models.TestSessionParams{DurationMinutes: 30}, uuid.NewString(), now)
		if err != nil {
			t.Fatal(err)
		}
		s.Assignments = []models.ExamAssignment{{MDMUserUUID: student}, {MDMUserUUID: other}}
		if _, err := store.TestSessionCreate(ctx, s); err != nil {
			t.Fatal(err)
		}
		return s
	}
	first := create()
	start := func(s *models.TestSession, user string) (*models.TestAttempt, error) {
		a, err := models.NewTestAttempt(s, models.TestAttemptParams{FullName: "Test Student", StudentGroup: "101", MDMUserUUID: user}, uuid.NewString(), 42, now)
		if err != nil {
			return nil, err
		}
		a, _, err = store.ExamStartOnce(ctx, s, a, now)
		return a, err
	}
	var wg sync.WaitGroup
	attempts := make(chan *models.TestAttempt, 8)
	failures := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			a, err := start(first, student)
			if err != nil {
				failures <- err
			} else {
				attempts <- a
			}
		}(i)
	}
	wg.Wait()
	close(attempts)
	close(failures)
	for err := range failures {
		t.Fatal(err)
	}
	var active *models.TestAttempt
	for a := range attempts {
		if active != nil && active.ID != a.ID {
			t.Fatal("parallel starts created another attempt")
		}
		active = a
	}
	if active == nil {
		t.Fatal("no attempt created")
	}
	if err := db.Model(active).Update("status", enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED).Error; err != nil {
		t.Fatal(err)
	}

	if _, err := start(first, student); !errors.Is(err, models.ErrExamAlreadyTaken) {
		t.Fatalf("same session granted a retake: %v", err)
	}
	list, err := store.ExamPublicFetch(ctx, now, student)
	if err != nil || len(list) != 0 {
		t.Fatalf("completed session visible: %v %v", list, err)
	}
	// Closing and reopening the same session must preserve the restriction.
	if err := store.TestSessionOpenUpdate(ctx, first.ID, false); err != nil {
		t.Fatal(err)
	}
	if err := store.TestSessionOpenUpdate(ctx, first.ID, true); err != nil {
		t.Fatal(err)
	}
	if _, err := start(first, student); !errors.Is(err, models.ErrExamAlreadyTaken) {
		t.Fatalf("reopened session granted a retake: %v", err)
	}
	second := create()
	fresh, err := start(second, student)
	if err != nil || fresh.ID == active.ID || fresh.SessionID != second.ID {
		t.Fatalf("new session did not grant an independent attempt: %v %v", fresh, err)
	}
	if err := db.Model(fresh).Update("status", enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED).Error; err != nil {
		t.Fatal(err)
	}
	list, err = store.ExamPublicFetch(ctx, now, student)
	if err != nil || len(list) != 0 {
		t.Fatalf("completed sessions visible: %v %v", list, err)
	}
	// Deleting a whole session must remove its limits, assignments and attempts.
	if err := store.TestSessionDelete(ctx, first.ID); err != nil {
		t.Fatal(err)
	}
	for _, model := range []any{&models.ExamParticipation{}, &models.ExamAssignment{}, &models.TestAttempt{}} {
		var count int64
		if err := db.Model(model).Where("session_id=?", first.ID).Count(&count).Error; err != nil || count != 0 {
			t.Fatalf("session deletion did not cascade: %T %d %v", model, count, err)
		}
	}
	third := create()
	thirdAttempt, err := start(third, student)
	if err != nil {
		t.Fatalf("deleted session blocked recreated session: %v", err)
	}
	// Explicitly removing a result releases only that session's entitlement.
	if err := store.TestAttemptDelete(ctx, fresh.ID); err != nil {
		t.Fatal(err)
	}
	retry, err := start(second, student)
	if err != nil || retry.ID == fresh.ID {
		t.Fatalf("deleted result did not grant a fresh attempt: %v %v", retry, err)
	}
	stillActive, err := start(third, student)
	if err != nil || stillActive.ID != thirdAttempt.ID {
		t.Fatalf("deleting another session result reset active attempt: %v %v", stillActive, err)
	}
	if err := store.TestSessionOpenUpdate(ctx, second.ID, false); err != nil {
		t.Fatal(err)
	}

	a, err := start(third, other)
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Model(a).Update("deadline", now.Add(-time.Second)).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := start(third, other); !errors.Is(err, models.ErrExamAlreadyTaken) {
		t.Fatalf("expired attempt granted retake: %v", err)
	}
	list, err = store.ExamPublicFetch(ctx, now, other)
	if err != nil || len(list) != 0 {
		t.Fatalf("expired subject visible: %v %v", list, err)
	}
}
