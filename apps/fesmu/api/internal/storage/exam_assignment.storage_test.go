package storage

import (
	"context"
	api "dvgmu/api"
	"dvgmu/api/internal/domain/models"
	enum "fesmu/contract/fesmu/enum/v1"
	"github.com/google/uuid"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"os"
	"testing"
	"time"
)

// Uses an explicitly supplied test database, never application configuration.
func TestExamAssignmentPostgresAccessAndTransaction(t *testing.T) {
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
	tests := TestStorageNew(db)
	sessions := TestSessionStorageNew(db)
	test := &models.Test{Department: "Assignment test", Discipline: "Test", Topic: uuid.NewString(), Version: enum.TestVersion_TEST_VERSION_V1, Questions: []models.TestQuestion{{Text: "Question", Answers: []models.TestAnswer{{Text: "Yes", IsCorrect: true}, {Text: "No"}}}}}
	if _, err := tests.TestCreate(ctx, test); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Where("test_id=?", test.ID).Delete(&models.TestSession{})
		db.Delete(&models.Test{}, test.ID)
	})
	a, b := uuid.NewString(), uuid.NewString()
	now := time.Now()
	create := func(student string) *models.TestSession {
		t.Helper()
		session, err := models.NewTestSession(test, models.TestSessionParams{DurationMinutes: 30, Audience: models.ExamAudience{Kind: "students", StudentUUIDs: []string{student}}}, uuid.NewString(), now)
		if err != nil {
			t.Fatal(err)
		}
		session.Assignments = []models.ExamAssignment{{MDMUserUUID: student}}
		if _, err := sessions.TestSessionCreate(ctx, session); err != nil {
			t.Fatal(err)
		}
		return session
	}
	first := create(a)
	second := create(b)
	list, err := sessions.ExamPublicFetch(ctx, now, a)
	if err != nil {
		t.Fatal(err)
	}
	if len(list) != 1 || list[0].Token != first.Token {
		t.Fatalf("catalogue leaks another student's session: %v", list)
	}
	if ok, err := sessions.ExamAssigned(ctx, second.ID, a); err != nil || ok {
		t.Fatalf("wrong assignment allowed: %v %v", ok, err)
	}
	if err := sessions.TestSessionOpenUpdate(ctx, second.ID, false); err != nil {
		t.Fatal(err)
	}
	list, err = sessions.ExamPublicFetch(ctx, now, b)
	if err != nil || len(list) != 0 {
		t.Fatalf("closed session visible: %v %v", list, err)
	}
	future := now.Add(time.Hour)
	if err := db.Model(first).Update("opens_at", future).Error; err != nil {
		t.Fatal(err)
	}
	list, err = sessions.ExamPublicFetch(ctx, now, a)
	if err != nil || len(list) != 0 {
		t.Fatalf("future session visible: %v %v", list, err)
	}
	duplicate, err := models.NewTestSession(test, models.TestSessionParams{DurationMinutes: 30}, uuid.NewString(), now)
	if err != nil {
		t.Fatal(err)
	}
	duplicate.Assignments = []models.ExamAssignment{{MDMUserUUID: a}, {MDMUserUUID: a}}
	if _, err := sessions.TestSessionCreate(ctx, duplicate); err == nil {
		t.Fatal("duplicate mapping accepted")
	}
	var count int64
	if err := db.Model(&models.TestSession{}).Where("token=?", duplicate.Token).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatal("failed recipient insert left a partially created session")
	}
	if err := sessions.TestSessionDelete(ctx, first.ID); err != nil {
		t.Fatal(err)
	}
	if ok, err := sessions.ExamAssigned(ctx, first.ID, a); err != nil || ok {
		t.Fatalf("assignment did not cascade: %v %v", ok, err)
	}
}
