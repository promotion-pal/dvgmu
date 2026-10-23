package grpc

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"connectrpc.com/connect"

	enum "dvgmu/api/contract/gen/go/enum/v1"
	pb "dvgmu/api/contract/gen/go/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

// memoryComputerClassStorage keeps overlaps, like the gorm storage does.
type memoryComputerClassStorage struct {
	nextID   int64
	sessions map[int64]*models.ComputerClassSession
}

func (m *memoryComputerClassStorage) ComputerClassSessionFetch(_ context.Context, f models.ComputerClassSessionFilter) ([]*models.ComputerClassSession, error) {
	var out []*models.ComputerClassSession
	for _, s := range m.sessions {
		if (f.Room == "" || s.Room == f.Room) && (f.DateFrom == "" || s.Date >= f.DateFrom) && (f.DateTo == "" || s.Date <= f.DateTo) &&
			(f.Kind == 0 || s.Kind == f.Kind) {
			out = append(out, s)
		}
	}
	return out, nil
}

func (m *memoryComputerClassStorage) ComputerClassSessionCreate(_ context.Context, s *models.ComputerClassSession) (int64, error) {
	m.nextID++
	s.ID = m.nextID
	m.sessions[s.ID] = s
	return s.ID, nil
}

func (m *memoryComputerClassStorage) ComputerClassSessionUpdate(_ context.Context, s *models.ComputerClassSession) error {
	if _, ok := m.sessions[s.ID]; !ok {
		return models.ErrComputerClassSessionNotFound
	}
	m.sessions[s.ID] = s
	return nil
}

func (m *memoryComputerClassStorage) ComputerClassSessionDelete(_ context.Context, id int64) error {
	if _, ok := m.sessions[id]; !ok {
		return models.ErrComputerClassSessionNotFound
	}
	delete(m.sessions, id)
	return nil
}

func newTestComputerClassHandler() *ComputerClassHandler {
	store := &memoryComputerClassStorage{sessions: map[int64]*models.ComputerClassSession{}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return ComputerClassNewController(service.NewComputerClassService(log, store, store))
}

func session(room, start, end string) *pb.ComputerClassSessionCreateRequest {
	return &pb.ComputerClassSessionCreateRequest{
		Date: "2026-10-05", TimeStart: start, TimeEnd: end, Room: room,
		Kind:  enum.ComputerClassSessionKind_COMPUTER_CLASS_SESSION_KIND_TESTING,
		Title: "Тестирование по анатомии", Groups: "101–104",
	}
}

func TestComputerClassSessionLifecycle(t *testing.T) {
	ctx := context.Background()
	h := newTestComputerClassHandler()

	created, err := h.ComputerClassSessionCreate(ctx, connect.NewRequest(session("ауд. 305", "09:00", "10:30")))
	if err != nil {
		t.Fatal(err)
	}
	id := created.Msg.GetComputerClassSessionId()

	list, _ := h.ComputerClassSessionFetch(ctx, connect.NewRequest(&pb.ComputerClassSessionFetchRequest{Room: "ауд. 305", DateFrom: "2026-10-01"}))
	if len(list.Msg.GetList()) != 1 || list.Msg.GetList()[0].GetGroups() != "101–104" {
		t.Fatalf("expected the session, got %v", list.Msg.GetList())
	}

	_, err = h.ComputerClassSessionUpdate(ctx, connect.NewRequest(&pb.ComputerClassSessionUpdateRequest{
		Id: id, Date: "2026-10-05", TimeStart: "09:00", TimeEnd: "11:00", Room: "ауд. 305", Title: "Занятие",
		Kind: enum.ComputerClassSessionKind_COMPUTER_CLASS_SESSION_KIND_LESSON,
	}))
	if err != nil {
		t.Fatal(err)
	}

	testing, _ := h.ComputerClassSessionFetch(ctx, connect.NewRequest(&pb.ComputerClassSessionFetchRequest{
		Kind: enum.ComputerClassSessionKind_COMPUTER_CLASS_SESSION_KIND_TESTING,
	}))
	if len(testing.Msg.GetList()) != 0 {
		t.Fatalf("the session became a lesson, the testing filter must skip it: %v", testing.Msg.GetList())
	}

	if _, err := h.ComputerClassSessionDelete(ctx, connect.NewRequest(&pb.ComputerClassSessionDeleteRequest{Id: id})); err != nil {
		t.Fatal(err)
	}
	_, err = h.ComputerClassSessionDelete(ctx, connect.NewRequest(&pb.ComputerClassSessionDeleteRequest{Id: id}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound on a second delete, got %v", err)
	}
}

func TestComputerClassSessionRules(t *testing.T) {
	ctx := context.Background()
	h := newTestComputerClassHandler()

	cases := map[string]struct {
		mutate func(*pb.ComputerClassSessionCreateRequest)
		want   connect.Code
	}{
		"no room":     {func(r *pb.ComputerClassSessionCreateRequest) { r.Room = " " }, connect.CodeInvalidArgument},
		"no kind":     {func(r *pb.ComputerClassSessionCreateRequest) { r.Kind = 0 }, connect.CodeInvalidArgument},
		"bad kind":    {func(r *pb.ComputerClassSessionCreateRequest) { r.Kind = 9 }, connect.CodeInvalidArgument},
		"no title":    {func(r *pb.ComputerClassSessionCreateRequest) { r.Title = "" }, connect.CodeInvalidArgument},
		"bad date":    {func(r *pb.ComputerClassSessionCreateRequest) { r.Date = "05.10.2026" }, connect.CodeInvalidArgument},
		"bad time":    {func(r *pb.ComputerClassSessionCreateRequest) { r.TimeStart = "9:00" }, connect.CodeInvalidArgument},
		"ends before": {func(r *pb.ComputerClassSessionCreateRequest) { r.TimeEnd = "08:00" }, connect.CodeInvalidArgument},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			req := session("ауд. 305", "09:00", "10:30")
			tc.mutate(req)
			_, err := h.ComputerClassSessionCreate(ctx, connect.NewRequest(req))
			if connect.CodeOf(err) != tc.want {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
		})
	}

	if _, err := h.ComputerClassSessionCreate(ctx, connect.NewRequest(session("ауд. 305", "09:00", "10:30"))); err != nil {
		t.Fatal(err)
	}
	// An overlap in the same room is saved: the timetable shows the clash.
	if _, err := h.ComputerClassSessionCreate(ctx, connect.NewRequest(session("ауд. 305", "10:00", "11:00"))); err != nil {
		t.Fatalf("an overlap must be saved, got %v", err)
	}
}
