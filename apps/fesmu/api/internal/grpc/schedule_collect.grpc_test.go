package grpc

import (
	"context"
	"io"
	"log/slog"
	"os"
	"strings"
	"testing"

	"connectrpc.com/connect"
	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
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
	for _, name := range []string{"20260928120000_schedule.sql", "20261127120000_schedule_collect_author.sql", "20261128120000_schedule_collect_batches.sql"} {
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
	reviewer := auth.WithUser(ctx, &auth.User{Permissions: []string{auth.Perm(auth.SectionScheduleIntake, auth.ActionFetch)}})
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
	if _, err := handler.ScheduleCollectFetch(editor, connect.NewRequest(inbox)); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("group timetable editor inbox error = %v", err)
	}
	for i := 0; i < 51; i++ {
		result, err := handler.ScheduleCollectCreate(teacher, connect.NewRequest(submission))
		if err != nil || !result.Msg.GetSuccess() || result.Msg.GetItem().GetAuthorUuid() != teacherID {
			t.Fatalf("submission %d = %v, %v", i, result, err)
		}
	}
	result, err := handler.ScheduleCollectFetch(reviewer, connect.NewRequest(inbox))
	if err != nil || len(result.Msg.GetItems()) != 50 || !result.Msg.GetHasMore() {
		t.Fatalf("first inbox page = %v, %v", result, err)
	}
	next, err := handler.ScheduleCollectFetch(reviewer, connect.NewRequest(&pb.ScheduleCollectFetchRequest{Offset: 50}))
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

	t.Run("atomic batch and retry", func(t *testing.T) {
		first := proto.CloneOf(submission.GetItem())
		first.Id = uuid.NewString()
		first.BatchId = uuid.NewString()
		first.BatchRow = 48
		first.Day = 7
		first.Group = " 401 "
		second := proto.CloneOf(submission.GetItem())
		second.Les = 3
		second.Subject = strings.Repeat("я", 255)
		batch := &pb.ScheduleCollectBatchCreateRequest{
			BatchId: uuid.NewString(), Items: []*entity.ScheduleCollectEntry{first, second},
		}
		count := func() int64 {
			var rows int64
			if err := tx.Table("schedule_collect_entries").Where("batch_id = ?", batch.BatchId).Count(&rows).Error; err != nil {
				t.Fatal(err)
			}
			return rows
		}
		for _, denial := range []struct {
			user context.Context
			code connect.Code
		}{{ctx, connect.CodeUnauthenticated}, {student, connect.CodePermissionDenied}, {reviewer, connect.CodePermissionDenied}} {
			if _, err := handler.ScheduleCollectBatchCreate(denial.user, connect.NewRequest(batch)); connect.CodeOf(err) != denial.code {
				t.Fatalf("batch submission error = %v, want %v", err, denial.code)
			}
		}
		invalid := proto.CloneOf(batch)
		invalid.Items[1].Aud = ""
		if _, err := handler.ScheduleCollectBatchCreate(teacher, connect.NewRequest(invalid)); connect.CodeOf(err) != connect.CodeInvalidArgument || !strings.Contains(err.Error(), "строка 2") {
			t.Fatalf("invalid second row error = %v", err)
		}
		tooLong := proto.CloneOf(batch)
		tooLong.Items[1].Subject += "я"
		if _, err := handler.ScheduleCollectBatchCreate(teacher, connect.NewRequest(tooLong)); connect.CodeOf(err) != connect.CodeInvalidArgument ||
			!strings.Contains(err.Error(), "строка 2") || !strings.Contains(err.Error(), "дисциплина") {
			t.Fatalf("long second row error = %v", err)
		}
		duplicate := proto.CloneOf(batch)
		duplicate.Items[1] = proto.CloneOf(first)
		duplicate.Items[1].Group = "401"
		if _, err := handler.ScheduleCollectBatchCreate(teacher, connect.NewRequest(duplicate)); connect.CodeOf(err) != connect.CodeInvalidArgument || !strings.Contains(err.Error(), "повторяет строку 1") {
			t.Fatalf("duplicate row error = %v", err)
		}
		if rows := count(); rows != 0 {
			t.Fatalf("invalid batches wrote %d rows", rows)
		}
		created, err := handler.ScheduleCollectBatchCreate(teacher, connect.NewRequest(batch))
		if err != nil || len(created.Msg.GetItems()) != 2 {
			t.Fatalf("batch submission = %v, %v", created, err)
		}
		for i, row := range created.Msg.Items {
			if row.GetBatchId() != batch.BatchId || row.GetBatchRow() != uint32(i+1) || row.GetAuthorUuid() != teacherID ||
				row.GetDay() != 1 || row.GetId() == first.GetId() || row.GetLes() != batch.Items[i].GetLes() || row.GetGroup() != "401" {
				t.Fatalf("stored row %d = %v", i, row)
			}
		}
		batch.Items[0].Group = "401"
		again, err := handler.ScheduleCollectBatchCreate(teacher, connect.NewRequest(batch))
		if err != nil || !proto.Equal(again.Msg, created.Msg) {
			t.Fatalf("batch retry = %v, %v", again, err)
		}
		otherTeacher := auth.WithUser(ctx, &auth.User{UUID: uuid.NewString(), Roles: []string{auth.RoleTeacher}})
		if _, err := handler.ScheduleCollectBatchCreate(otherTeacher, connect.NewRequest(batch)); connect.CodeOf(err) != connect.CodeAlreadyExists {
			t.Fatalf("another teacher's batch retry error = %v", err)
		}
		batch.Items[1].Aud = "313"
		if _, err := handler.ScheduleCollectBatchCreate(teacher, connect.NewRequest(batch)); connect.CodeOf(err) != connect.CodeAlreadyExists {
			t.Fatalf("changed batch retry error = %v", err)
		}
		if rows := count(); rows != 2 {
			t.Fatalf("retried batch wrote %d rows", rows)
		}
		page, err := handler.ScheduleCollectFetch(reviewer, connect.NewRequest(inbox))
		if err != nil || page.Msg.GetItems()[0].GetBatchId() != batch.GetBatchId() || page.Msg.GetItems()[0].GetBatchRow() != 1 ||
			page.Msg.GetItems()[1].GetBatchId() != batch.GetBatchId() || page.Msg.GetItems()[1].GetBatchRow() != 2 {
			t.Fatalf("inbox after batch = %v, %v", page, err)
		}
	})
}
