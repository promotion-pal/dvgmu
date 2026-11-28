package grpc

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/types/known/timestamppb"

	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

func validTimetable() *entity.ScheduleTimetable {
	return &entity.ScheduleTimetable{
		Title:    "Лечебное дело, 1 курс",
		Program:  &entity.ScheduleProgram{Id: "lech", Code: "31.05.01", Name: "Лечебное дело"},
		Course:   1,
		Semester: &entity.ScheduleSemester{Label: "Осень 2026/27", Start: "2026-09-01", End: "2026-12-31"},
		Groups:   []string{"101"},
		Slots:    []*entity.ScheduleSlot{{Id: "s1", Start: "08:30", End: "10:10"}},
		Subjects: []*entity.ScheduleSubject{{Id: "anat", Name: "Анатомия"}},
		Entries: []*entity.ScheduleEntry{{
			Id: "e1", Weekday: 1, SlotId: "s1", GroupIds: []string{"101"}, SubjectId: "anat",
		}},
		Periods: []*entity.SchedulePeriod{{
			Id: "p1", Kind: enum.SchedulePeriodKind_SCHEDULE_PERIOD_KIND_STUDY,
			Label: "Учёба", From: "2026-09-01", To: "2026-12-20",
		}},
	}
}

// memoryScheduleStorage is an in-memory ScheduleSaver/ScheduleProvider.
type memoryScheduleStorage struct{ records map[string]*models.Schedule }

func (m *memoryScheduleStorage) ScheduleFetch(_ context.Context, f models.ScheduleFilter) ([]*models.Schedule, error) {
	var out []*models.Schedule
	for _, r := range m.records {
		if (f.ProgramID == "" || r.ProgramID == f.ProgramID) && (f.Course == 0 || r.Course == f.Course) {
			out = append(out, r)
		}
	}
	return out, nil
}

func (m *memoryScheduleStorage) ScheduleByID(_ context.Context, id string) (*models.Schedule, error) {
	if r, ok := m.records[id]; ok {
		return r, nil
	}
	return nil, models.ErrScheduleNotFound
}

func (m *memoryScheduleStorage) ScheduleCreate(_ context.Context, r *models.Schedule) (string, error) {
	m.records[r.ID] = r
	return r.ID, nil
}

func (m *memoryScheduleStorage) ScheduleUpdate(_ context.Context, r *models.Schedule, expectedUpdatedAt time.Time) error {
	old, ok := m.records[r.ID]
	if !ok {
		return models.ErrScheduleNotFound
	}
	if !old.UpdatedAt.Equal(expectedUpdatedAt) {
		return models.ErrScheduleStale
	}
	r.CreatedAt = old.CreatedAt
	m.records[r.ID] = r
	return nil
}

func (m *memoryScheduleStorage) ScheduleDelete(_ context.Context, id string) error {
	if _, ok := m.records[id]; !ok {
		return models.ErrScheduleNotFound
	}
	delete(m.records, id)
	return nil
}

func newTestScheduleHandler() *ScheduleHandler {
	store := &memoryScheduleStorage{records: map[string]*models.Schedule{}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return ScheduleNewController(service.NewScheduleService(log, store, store))
}

func TestScheduleCreateFetchUpdateDelete(t *testing.T) {
	ctx := context.Background()
	editor := auth.WithUser(ctx, &auth.User{Permissions: []string{auth.Perm(auth.SectionSchedule, auth.ActionPost)}})
	h := newTestScheduleHandler()

	created, err := h.ScheduleCreate(editor, connect.NewRequest(&pb.ScheduleCreateRequest{Item: validTimetable()}))
	if err != nil {
		t.Fatal(err)
	}
	id := created.Msg.GetScheduleId()
	if id == "" {
		t.Fatal("the server must assign an id")
	}

	list, _ := h.ScheduleFetch(ctx, connect.NewRequest(&pb.ScheduleFetchRequest{ProgramId: "lech", Course: 1}))
	if len(list.Msg.GetList()) != 1 || list.Msg.GetList()[0].GetId() != id {
		t.Fatalf("expected the created timetable, got %v", list.Msg.GetList())
	}
	other, _ := h.ScheduleFetch(ctx, connect.NewRequest(&pb.ScheduleFetchRequest{Course: 2}))
	if len(other.Msg.GetList()) != 0 {
		t.Fatal("course filter must exclude it")
	}

	edited := list.Msg.GetList()[0]
	edited.Title = "Новое название"
	if _, err := h.ScheduleUpdate(editor, connect.NewRequest(&pb.ScheduleUpdateRequest{Item: edited})); err != nil {
		t.Fatal(err)
	}
	edited.Title = "Устаревшее изменение"
	if _, err := h.ScheduleUpdate(editor, connect.NewRequest(&pb.ScheduleUpdateRequest{Item: edited})); connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("expected FailedPrecondition for stale edit, got %v", err)
	}
	got, _ := h.ScheduleByID(ctx, connect.NewRequest(&pb.ScheduleByIDRequest{Id: id}))
	if got.Msg.GetItem().GetTitle() != "Новое название" {
		t.Fatalf("update not applied: %v", got.Msg.GetItem().GetTitle())
	}

	if _, err := h.ScheduleDelete(editor, connect.NewRequest(&pb.ScheduleDeleteRequest{Id: id})); err != nil {
		t.Fatal(err)
	}
	_, err = h.ScheduleByID(ctx, connect.NewRequest(&pb.ScheduleByIDRequest{Id: id}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound after delete, got %v", err)
	}
}

func TestScheduleHandlerMapsErrorsToStatusCodes(t *testing.T) {
	ctx := auth.WithUser(t.Context(), &auth.User{Roles: []string{auth.RoleAdmin}})
	h := newTestScheduleHandler()

	broken := validTimetable()
	broken.Groups = nil
	_, err := h.ScheduleCreate(ctx, connect.NewRequest(&pb.ScheduleCreateRequest{Item: broken}))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("invalid timetable must be InvalidArgument, got %v", err)
	}

	missing := validTimetable()
	missing.Id = "nope"
	missing.UpdatedAt = timestamppb.Now()
	_, err = h.ScheduleUpdate(ctx, connect.NewRequest(&pb.ScheduleUpdateRequest{Item: missing}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("updating a missing timetable must be NotFound, got %v", err)
	}

	_, err = h.ScheduleUpdate(ctx, connect.NewRequest(&pb.ScheduleUpdateRequest{Item: validTimetable()}))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("update without id must be InvalidArgument, got %v", err)
	}

	missing.UpdatedAt = nil
	_, err = h.ScheduleUpdate(ctx, connect.NewRequest(&pb.ScheduleUpdateRequest{Item: missing}))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("update without a known version must be InvalidArgument, got %v", err)
	}
}

func TestScheduleWritesRequireEditPermission(t *testing.T) {
	h := newTestScheduleHandler()
	student := auth.WithUser(t.Context(), &auth.User{Roles: []string{auth.RoleStudent}})
	for _, tc := range []struct {
		ctx  context.Context
		want connect.Code
	}{{t.Context(), connect.CodeUnauthenticated}, {student, connect.CodePermissionDenied}} {
		_, createErr := h.ScheduleCreate(tc.ctx, connect.NewRequest(&pb.ScheduleCreateRequest{}))
		_, updateErr := h.ScheduleUpdate(tc.ctx, connect.NewRequest(&pb.ScheduleUpdateRequest{}))
		_, deleteErr := h.ScheduleDelete(tc.ctx, connect.NewRequest(&pb.ScheduleDeleteRequest{}))
		for _, err := range []error{createErr, updateErr, deleteErr} {
			if connect.CodeOf(err) != tc.want {
				t.Errorf("write error = %v, want %v", err, tc.want)
			}
		}
	}
}

func TestScheduleFetchFailsWhenDocumentIsUnreadable(t *testing.T) {
	valid, err := models.NewSchedule(validTimetable())
	if err != nil {
		t.Fatal(err)
	}
	valid.ID = "valid"
	store := &memoryScheduleStorage{records: map[string]*models.Schedule{
		"valid":  valid,
		"broken": {ID: "broken", Body: `{"course":"invalid"}`},
	}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	h := ScheduleNewController(service.NewScheduleService(log, store, store))
	response, err := h.ScheduleFetch(t.Context(), connect.NewRequest(&pb.ScheduleFetchRequest{}))
	if response != nil || connect.CodeOf(err) != connect.CodeInternal {
		t.Fatalf("expected an internal error instead of a partial list, got %v, %v", response, err)
	}
}
