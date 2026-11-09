package service

import (
	"context"
	"dvgmu/api/internal/domain/models"
	"errors"
	enum "fesmu/contract/fesmu/enum/v1"
	pb "fesmu/contract/mdm/service"
	"google.golang.org/protobuf/proto"
	"io"
	"log/slog"
	"testing"
	"time"
)

const assignedUUID = "11111111-1111-4111-8111-111111111111"
const otherUUID = "22222222-2222-4222-8222-222222222222"

type fakeExamDirectory struct {
	calls []*pb.UserDirectoryFetchRequest
	fetch func(*pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error)
}

func (f *fakeExamDirectory) Fetch(_ context.Context, q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
	copy := proto.Clone(q).(*pb.UserDirectoryFetchRequest)
	f.calls = append(f.calls, copy)
	return f.fetch(q)
}
func examStudentPage(uuid string) *pb.UserDirectoryFetchResponse {
	return &pb.UserDirectoryFetchResponse{ProfileKind: "student", Total: 1, Users: []*pb.UserDirectoryEntry{{Uuid: uuid, FullName: "Иванов Иван Иванович", Students: []*pb.UserDirectoryStudent{{FacultyCode: 20, Course: 2, Group: "201"}}}}}
}

type assignmentTestStore struct {
	TestSessionStore
	session        *models.TestSession
	allowed        bool
	created        *models.TestAttempt
	createdSession *models.TestSession
}

func (f *assignmentTestStore) TestSessionByToken(context.Context, string) (*models.TestSession, error) {
	return f.session, nil
}
func (f *assignmentTestStore) ExamAssigned(_ context.Context, id int64, uuid string) (bool, error) {
	return f.allowed && id == f.session.ID && uuid == assignedUUID, nil
}
func (f *assignmentTestStore) TestAttemptCreate(_ context.Context, a *models.TestAttempt) (int64, error) {
	f.created = a
	return 1, nil
}
func (f *assignmentTestStore) TestSessionCreate(_ context.Context, s *models.TestSession) (int64, error) {
	f.createdSession = s
	return 1, nil
}
func (f *assignmentTestStore) ExamPublicFetch(_ context.Context, _ time.Time, uuid string) ([]models.ExamPublicTest, error) {
	if uuid != assignedUUID {
		return nil, nil
	}
	return []models.ExamPublicTest{{TestID: 1, Token: "exam"}}, nil
}

type assignmentTestProvider struct {
	TestProvider
	test *models.Test
}

func (f *assignmentTestProvider) TestByID(context.Context, int64) (*models.Test, error) {
	return f.test, nil
}
func assignmentTestData(t *testing.T) (*models.Test, *models.TestSession) {
	t.Helper()
	test := &models.Test{ID: 1, Department: "Педиатрия", Discipline: "Анатомия", Topic: "Экзамен", Version: enum.TestVersion_TEST_VERSION_V1, Questions: []models.TestQuestion{{ID: 1, Text: "Вопрос", Answers: []models.TestAnswer{{ID: 1, Text: "Да", IsCorrect: true}, {ID: 2, Text: "Нет"}}}}}
	session, err := models.NewTestSession(test, models.TestSessionParams{DurationMinutes: 30}, "exam", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	session.ID = 9
	return test, session
}
func TestExamStartRequiresAssignmentAndUsesMDMIdentity(t *testing.T) {
	_, session := assignmentTestData(t)
	directory := &fakeExamDirectory{fetch: func(q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		if (q.Role != 0 || q.UserStatus != 0 || q.ProfileKind != "student" || !q.ActiveStudentsOnly) || q.RecordBook != "2025001" {
			t.Fatalf("identity must be filtered in MDM: %v", q)
		}
		return examStudentPage(assignedUUID), nil
	}}
	store := &assignmentTestStore{session: session}
	s := NewTestSessionService(slog.New(slog.NewTextHandler(io.Discard, nil)), store, nil).WithExamDirectory(directory)
	input := models.TestAttemptParams{RecordBook: "2025001", FullName: "Поддельное имя", StudentGroup: "999"}
	if _, err := s.TestTakeStart(context.Background(), "exam", input); !errors.Is(err, models.ErrExamNotAssigned) {
		t.Fatalf("unassigned start: %v", err)
	}
	if store.created != nil {
		t.Fatal("unassigned attempt was stored")
	}
	store.allowed = true
	view, err := s.TestTakeStart(context.Background(), "exam", input)
	if err != nil {
		t.Fatal(err)
	}
	if view.Attempt.MDMUserUUID != assignedUUID || view.Attempt.FullName != "Иванов Иван Иванович" || view.Attempt.StudentGroup != "201" {
		t.Fatalf("client identity was trusted: %+v", view.Attempt)
	}
	directory.fetch = func(*pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		return nil, errors.New("offline")
	}
	store.created = nil
	if _, err := s.TestTakeStart(context.Background(), "exam", input); !errors.Is(err, models.ErrExamDirectory) {
		t.Fatalf("MDM failure must fail closed: %v", err)
	}
	if store.created != nil {
		t.Fatal("attempt stored while MDM unavailable")
	}
}
func TestExamCourseAndGroupRecipientsArePaginatedDeduplicatedUUIDs(t *testing.T) {
	for _, kind := range []string{"course", "group"} {
		t.Run(kind, func(t *testing.T) {
			d := &fakeExamDirectory{fetch: func(q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
				if q.FacultyCode != 20 || (q.Role != 0 || q.UserStatus != 0 || q.ProfileKind != "student" || !q.ActiveStudentsOnly) {
					t.Fatalf("missing scoped filter: %v", q)
				}
				if kind == "course" && q.Course != 2 {
					t.Fatal("missing course")
				}
				if kind == "group" && q.StudentGroup != "201" {
					t.Fatal("missing group")
				}
				if q.Offset == 0 {
					return &pb.UserDirectoryFetchResponse{ProfileKind: "student", Users: []*pb.UserDirectoryEntry{{Uuid: assignedUUID}}, NextOffset: 1}, nil
				}
				return &pb.UserDirectoryFetchResponse{ProfileKind: "student", Users: []*pb.UserDirectoryEntry{{Uuid: assignedUUID}, {Uuid: otherUUID}}}, nil
			}}
			s := NewTestSessionService(nil, nil, nil).WithExamDirectory(d)
			recipients, err := s.examRecipients(context.Background(), models.ExamAudience{Kind: kind, FacultyCode: 20, Course: 2, StudentGroup: "201"})
			if err != nil {
				t.Fatal(err)
			}
			if len(recipients) != 2 || len(d.calls) != 2 {
				t.Fatalf("expected one batched query per page: %v / %v", recipients, d.calls)
			}
		})
	}
}
func TestExamMissingSelectedRecipientAndAmbiguousRecordBookFailClosed(t *testing.T) {
	d := &fakeExamDirectory{fetch: func(*pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		return examStudentPage(assignedUUID), nil
	}}
	s := NewTestSessionService(nil, nil, nil).WithExamDirectory(d)
	if _, err := s.examRecipients(context.Background(), models.ExamAudience{Kind: "students", StudentUUIDs: []string{assignedUUID, otherUUID}}); !errors.Is(err, models.ErrExamAudience) {
		t.Fatalf("missing selected user: %v", err)
	}
	d.fetch = func(*pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		p := examStudentPage(assignedUUID)
		p.Total = 2
		return p, nil
	}
	if _, err := s.ExamPublicFetch(context.Background(), "2025001"); !errors.Is(err, models.ErrExamStudent) {
		t.Fatalf("ambiguous identity: %v", err)
	}
}
func TestExamSessionStoresRecipientSnapshotAndRejectsMissingAudience(t *testing.T) {
	test, _ := assignmentTestData(t)
	store := &assignmentTestStore{}
	d := &fakeExamDirectory{fetch: func(*pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		return examStudentPage(assignedUUID), nil
	}}
	s := NewTestSessionService(slog.New(slog.NewTextHandler(io.Discard, nil)), store, &assignmentTestProvider{test: test}).WithExamDirectory(d)
	if _, err := s.TestSessionCreate(context.Background(), 1, models.TestSessionParams{DurationMinutes: 30}); !errors.Is(err, models.ErrExamAudience) {
		t.Fatalf("empty audience accepted: %v", err)
	}
	params := models.TestSessionParams{DurationMinutes: 30, ShowResult: true, Audience: models.ExamAudience{Kind: "students", StudentUUIDs: []string{assignedUUID}}}
	session, err := s.TestSessionCreate(context.Background(), 1, params)
	if err != nil {
		t.Fatal(err)
	}
	if session.ShowResult {
		t.Fatal("exam must hide results regardless of client preference")
	}
	if len(session.Assignments) != 1 || session.Assignments[0].MDMUserUUID != assignedUUID || session.AssignedCount != 1 {
		t.Fatalf("missing UUID mapping: %+v", session)
	}
}

func TestExamCatalogueReturnsStudentEvenWithoutAssignedExams(t *testing.T) {
	d := &fakeExamDirectory{fetch: func(q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		if q.Role != 0 || q.UserStatus != 0 || q.ProfileKind != "student" {
			t.Fatalf("record-book access must not depend on login: %v", q)
		}
		return examStudentPage(otherUUID), nil
	}}
	store := &assignmentTestStore{}
	s := NewTestSessionService(nil, store, nil).WithExamDirectory(d)
	catalogue, err := s.ExamPublicFetch(context.Background(), "2025001")
	if err != nil {
		t.Fatal(err)
	}
	if len(catalogue.Exams) != 0 || catalogue.Student.FullName != "Иванов Иван Иванович" || catalogue.Student.StudentGroup != "201" {
		t.Fatalf("student information disappeared when no tests assigned: %+v", catalogue)
	}
}

func TestExamDirectoryRejectsServerThatIgnoredProfileFilter(t *testing.T) {
	d := &fakeExamDirectory{fetch: func(*pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
		page := examStudentPage(assignedUUID)
		page.ProfileKind = ""
		return page, nil
	}}
	s := NewTestSessionService(nil, nil, nil).WithExamDirectory(d)
	if _, err := s.ExamAudienceFetch(context.Background(), &pb.UserDirectoryFetchRequest{}); !errors.Is(err, models.ErrExamDirectory) {
		t.Fatalf("legacy MDM filter ignored: %v", err)
	}
	if _, err := s.ExamPublicFetch(context.Background(), "2025001"); !errors.Is(err, models.ErrExamDirectory) {
		t.Fatalf("legacy MDM exposed public identity: %v", err)
	}
}

func (f *assignmentTestStore) ExamStartOnce(_ context.Context, session *models.TestSession, a *models.TestAttempt, _ time.Time) (*models.TestAttempt, *models.TestSession, error) {
	f.created = a
	return a, session, nil
}
