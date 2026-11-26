package service

import (
	"context"
	"dvgmu/api/internal/domain/models"
	pb "fesmu/contract/mdm/service"
	"io"
	"log/slog"
	"testing"
	"time"
)

func TestIntermediateAssignmentWaitsForTeacherPermission(t *testing.T) {
	test, _ := assignmentTestData(t)
	test.ExamSettings = models.ExamV2Settings{Enabled: true, AssessmentKind: "intermediate"}
	store := &assignmentTestStore{}
	directory := &fakeExamDirectory{fetch: func(*pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		return examStudentPage(assignedUUID), nil
	}}
	svc := NewTestSessionService(slog.New(slog.NewTextHandler(io.Discard, nil)), store, &assignmentTestProvider{test: test}).WithExamDirectory(directory)
	session, err := svc.TestSessionCreate(context.Background(), 1, models.TestSessionParams{DurationMinutes: 30, Audience: models.ExamAudience{Kind: "students", StudentUUIDs: []string{assignedUUID}}})
	if err != nil {
		t.Fatal(err)
	}
	if session.IsOpen || session.ExamSettings.AssessmentKind != "intermediate" || len(session.Assignments) != 1 {
		t.Fatal("assignment did not wait for teacher permission")
	}
	if _, err := models.NewTestAttempt(session, models.TestAttemptParams{FullName: "Студент", StudentGroup: "201", InstructionAccepted: true}, "attempt", 1, time.Now()); err == nil {
		t.Fatal("closed intermediate test could start")
	}
	session.IsOpen = true
	if _, err := models.NewTestAttempt(session, models.TestAttemptParams{FullName: "Студент", StudentGroup: "201", InstructionAccepted: true}, "attempt", 1, time.Now()); err != nil {
		t.Fatal("open intermediate test could not start", err)
	}
}
