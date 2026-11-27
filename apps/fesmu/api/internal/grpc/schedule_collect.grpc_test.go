package grpc

import (
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/service"
	"dvgmu/api/internal/storage"
	entity "fesmu/contract/fesmu/entity/v1"
	pb "fesmu/contract/fesmu/service/v1"
)

func TestScheduleCollectSubmissionAndInbox(t *testing.T) {
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
	schema := "schedule_collect_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if err := tx.Exec("CREATE SCHEMA " + schema + "; SET LOCAL search_path TO " + schema).Error; err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"20260928120000_schedule.sql", "20261127120000_schedule_collect_author.sql"} {
		data, err := os.ReadFile("../../migrations/infrastructure/" + name)
		if err != nil {
			t.Fatal(err)
		}
		up, _, _ := strings.Cut(string(data), "-- +goose Down")
		if err := tx.Exec(up).Error; err != nil {
			t.Fatal(err)
		}
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := ScheduleCollectNewController(service.NewScheduleCollectService(log, storage.ScheduleCollectStorageNew(tx)))
	teacherID := uuid.NewString()
	ctx := t.Context()
	teacher := auth.WithUser(ctx, &auth.User{UUID: teacherID, Roles: []string{auth.RoleTeacher}})
	student := auth.WithUser(ctx, &auth.User{UUID: uuid.NewString(), Roles: []string{auth.RoleStudent}})
	editor := auth.WithUser(ctx, &auth.User{Permissions: []string{auth.Perm(auth.SectionSchedule, auth.ActionPost)}})
	submission := &pb.ScheduleCollectCreateRequest{Item: &entity.ScheduleCollectEntry{
		Group: "401", Day: 1, Les: 2, Aud: "312", Name: "Преподаватель",
		Subject: "Анатомия", SubjType: "пр.", Date: "2026-11-30", AuthorUuid: uuid.NewString(),
	}}
	inbox := &pb.ScheduleCollectFetchRequest{}

	if _, err := handler.ScheduleCollectCreate(ctx, connect.NewRequest(submission)); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("anonymous submission error = %v", err)
	}
	if _, err := handler.ScheduleCollectCreate(student, connect.NewRequest(submission)); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("student submission error = %v", err)
	}
	if _, err := handler.ScheduleCollectFetch(teacher, connect.NewRequest(inbox)); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("teacher inbox error = %v", err)
	}
	for i := 0; i < 51; i++ {
		result, err := handler.ScheduleCollectCreate(teacher, connect.NewRequest(submission))
		if err != nil || !result.Msg.GetSuccess() || result.Msg.GetItem().GetAuthorUuid() != teacherID {
			t.Fatalf("submission %d = %v, %v", i, result, err)
		}
	}
	result, err := handler.ScheduleCollectFetch(editor, connect.NewRequest(inbox))
	if err != nil || len(result.Msg.GetItems()) != 50 || !result.Msg.GetHasMore() {
		t.Fatalf("first inbox page = %v, %v", result, err)
	}
	next, err := handler.ScheduleCollectFetch(editor, connect.NewRequest(&pb.ScheduleCollectFetchRequest{Offset: 50}))
	if err != nil || len(next.Msg.GetItems()) != 1 || next.Msg.GetHasMore() {
		t.Fatalf("second inbox page = %v, %v", next, err)
	}
	item := next.Msg.GetItems()[0]
	if item.GetAuthorUuid() != teacherID || item.GetGroup() != "401" || item.GetSubject() != "Анатомия" {
		t.Fatalf("stored submission = %v", item)
	}
	for _, first := range result.Msg.GetItems() {
		if first.GetId() == item.GetId() {
			t.Fatal("submission appeared on both pages")
		}
	}
}
