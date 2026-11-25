package examv2

import (
	"connectrpc.com/connect"
	"context"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
	"errors"
	enum "fesmu/contract/fesmu/enum/v1"
	pb "fesmu/contract/fesmu/exam/service/v2"
	svc "fesmu/contract/fesmu/service/v1"
	"math"
	"testing"
	"time"
)

func validBank() *pb.Bank {
	return &pb.Bank{Specialty: "Педиатрия", Faculty: "Педиатрический факультет", Semester: 3, Discipline: "Анатомия", AcademicYear: "2026/2027", Season: "winter", VariantCount: 2, DurationMinutes: 20, Excellent: 90, Good: 80, Satisfactory: 70, Sections: []*pb.BankSection{{Name: "Кости", Quota: 1, Questions: []*svc.TestQuestionInput{{Text: "Вопрос", Answers: []*svc.TestAnswerInput{{Text: "Верно", IsCorrect: true}, {Text: "Неверно"}}}}}}}
}
func TestBankRejectsInvalidQuotasAndMultipleAnswers(t *testing.T) {
	if err := Validate(validBank()); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*pb.Bank){
		func(b *pb.Bank) { b.Sections[0].Quota = 2 },
		func(b *pb.Bank) { b.Sections[0].Questions[0].Answers[1].IsCorrect = true },
		func(b *pb.Bank) { b.Sections[0].Questions[0].Answers[0].IsCorrect = false },
		func(b *pb.Bank) { b.Good = b.Excellent },
		func(b *pb.Bank) { b.Semester = 13 },
	} {
		b := validBank()
		change(b)
		if err := Validate(b); err == nil {
			t.Fatalf("invalid bank accepted: %v", b)
		}
	}
}
func TestStatisticsUseObservedResponsesAndExcludeTrialOrRunning(t *testing.T) {
	session := &models.TestSession{ID: 1, Topic: "Экзамен", ExamSettings: Settings(validBank()), Questions: []models.TestSnapshotQuestion{{ID: 1, Text: "Вопрос", Answers: []models.TestSnapshotAnswer{{ID: 10, Text: "Да", IsCorrect: true}, {ID: 20, Text: "Нет"}}}}}
	views := []service.TestAttemptView{}
	for i, score := range []int{4, 3, 2, 1} {
		a := &models.TestAttempt{ID: int64(i + 1), Status: enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_FINISHED, Score: score, Total: 4}
		pick := int64(20)
		if i < 2 {
			pick = 10
		}
		a.Answers = []models.TestAttemptAnswer{{QuestionID: 1, AnswerIDs: []int64{pick}}}
		views = append(views, service.TestAttemptView{Attempt: a, Session: session, Questions: session.Questions})
	}
	views = append(views, service.TestAttemptView{Attempt: &models.TestAttempt{Status: enum.TestAttemptStatus_TEST_ATTEMPT_STATUS_IN_PROGRESS}, Session: session, Questions: session.Questions})
	report := Analyze(session, views)
	if len(report.Students) != 4 || len(report.Items) != 1 {
		t.Fatal(report)
	}
	item := report.Items[0]
	if item.Asked != 4 || item.Difficulty != .5 || item.Discrimination == nil || *item.Discrimination != 1 {
		t.Fatalf("incorrect item metrics: %+v", item)
	}
	if item.Alternatives[1].Percent != 50 || !item.Alternatives[1].Flag {
		t.Fatal("distractor threshold not applied")
	}
	if item.Correlation == nil || math.Abs(*item.Correlation-.707106781) > 1e-6 {
		t.Fatalf("corrected correlation: %v", item.Correlation)
	}
	if report.Summaries["university"][0].Count != 4 {
		t.Fatal("incorrect summary denominator")
	}
	if Pearson([]float64{1, 1, 1, 1}, []float64{0, 1, 2, 3}) != nil || Pearson([]float64{0, 1}, []float64{1, 2}) != nil {
		t.Fatal("undefined correlation must not be reported as a number")
	}
}
func TestStaffReportsRequireAccessAndOwnResultsRequireIdentity(t *testing.T) {
	m := New(nil, nil)
	if _, err := m.BankFetch(context.Background(), connect.NewRequest(&pb.BankFetchRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatal(err)
	}
	student := auth.WithUser(context.Background(), &auth.User{UUID: "student", Roles: []string{auth.RoleStudent}})
	if _, err := m.ReportFetch(student, connect.NewRequest(&pb.ReportFetchRequest{})); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatal(err)
	}
	if _, err := m.ResultsFetch(context.Background(), connect.NewRequest(&pb.StudentResultsRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatal(err)
	}
	if _, err := m.ResultsFetch(student, connect.NewRequest(&pb.StudentResultsRequest{})); connect.CodeOf(err) != connect.CodeUnavailable {
		t.Fatal(err)
	}
}
func TestV2RequiresInstructionAndUsesExactDeadline(t *testing.T) {
	now := time.Now()
	session := &models.TestSession{ID: 1, IsOpen: true, DurationMinutes: 20, ExamSettings: Settings(validBank())}
	input := models.TestAttemptParams{FullName: "Студент", StudentGroup: "201"}
	if _, err := models.NewTestAttempt(session, input, "token", 1, now); !errors.Is(err, models.ErrTestInvalid) {
		t.Fatal("instruction bypassed", err)
	}
	input.InstructionAccepted = true
	a, err := models.NewTestAttempt(session, input, "token", 1, now)
	if err != nil {
		t.Fatal(err)
	}
	if a.InstructionAcceptedAt == nil || len(a.Events) != 2 || !a.Expired(now.Add(20*time.Minute)) {
		t.Fatal("instruction or exact deadline not persisted")
	}
	session.ExamSettings.Enabled = false
	original, err := models.NewTestAttempt(session, models.TestAttemptParams{FullName: "Студент", StudentGroup: "201"}, "old", 1, now)
	if err != nil {
		t.Fatal(err)
	}
	if original.Expired(now.Add(20 * time.Minute)) {
		t.Fatal("legacy grace changed")
	}
}
