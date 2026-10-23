package grpc

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"connectrpc.com/connect"

	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/service"
)

// memoryHallStorage is an in-memory HallSaver/HallProvider with one hall (id 1).
// It rejects overlaps the same way the gorm storage does.
type memoryHallStorage struct {
	nextID   int64
	bookings map[int64]*models.HallBooking
}

func (m *memoryHallStorage) HallFetch(context.Context) ([]*models.Hall, error) {
	return []*models.Hall{{ID: 1, Name: "ауд. 238", Tone: "sky"}}, nil
}

func (m *memoryHallStorage) HallBookingFetch(_ context.Context, f models.HallBookingFilter) ([]*models.HallBooking, error) {
	var out []*models.HallBooking
	for _, b := range m.bookings {
		if (f.HallID == 0 || b.HallID == f.HallID) &&
			(f.DateFrom == "" || b.Date >= f.DateFrom) &&
			(f.DateTo == "" || b.Date <= f.DateTo) {
			out = append(out, b)
		}
	}
	return out, nil
}

func (m *memoryHallStorage) HallBookingCreate(_ context.Context, b *models.HallBooking) (int64, error) {
	if b.HallID != 1 {
		return 0, models.ErrHallNotFound
	}
	for _, other := range m.bookings {
		if other.HallID == b.HallID && other.Date == b.Date && other.TimeStart < b.TimeEnd && other.TimeEnd > b.TimeStart {
			return 0, models.ErrHallBookingTaken
		}
	}
	m.nextID++
	b.ID = m.nextID
	m.bookings[b.ID] = b
	return b.ID, nil
}

func (m *memoryHallStorage) HallBookingDelete(_ context.Context, id int64) error {
	if _, ok := m.bookings[id]; !ok {
		return models.ErrHallBookingNotFound
	}
	delete(m.bookings, id)
	return nil
}

func newTestHallHandler() *HallHandler {
	store := &memoryHallStorage{bookings: map[int64]*models.HallBooking{}}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return HallNewController(service.NewHallService(log, store, store))
}

// booking is a valid request; dates are far ahead so "not in the past" holds.
func booking(start, end string) *pb.HallBookingCreateRequest {
	return &pb.HallBookingCreateRequest{
		HallId: 1, Date: "2099-09-01", TimeStart: start, TimeEnd: end,
		Title: "Учёный совет", Organizer: "Иванов И.И.", Contact: "+7 900 000-00-00",
		PersonalDataConsent: true,
	}
}

func TestHallBookingCreateFetchDelete(t *testing.T) {
	ctx := context.Background()
	h := newTestHallHandler()

	created, err := h.HallBookingCreate(ctx, connect.NewRequest(booking("09:00", "10:30")))
	if err != nil {
		t.Fatal(err)
	}
	id := created.Msg.GetHallBookingId()

	list, _ := h.HallBookingFetch(ctx, connect.NewRequest(&pb.HallBookingFetchRequest{DateFrom: "2099-09-01", DateTo: "2099-09-30"}))
	if len(list.Msg.GetList()) != 1 || list.Msg.GetList()[0].GetOrganizer() != "Иванов И.И." {
		t.Fatalf("staff fetch must return the booking with its organizer, got %v", list.Msg.GetList())
	}

	public, _ := h.HallBookingPublicFetch(ctx, connect.NewRequest(&pb.HallBookingFetchRequest{}))
	got := public.Msg.GetList()
	if len(got) != 1 || got[0].GetTimeEnd() != "10:30" {
		t.Fatalf("public fetch must return the booking, got %v", got)
	}
	if got[0].GetOrganizer() != "" || got[0].GetContact() != "" {
		t.Fatalf("public fetch must not reveal who booked: %v", got[0])
	}

	other, _ := h.HallBookingFetch(ctx, connect.NewRequest(&pb.HallBookingFetchRequest{DateFrom: "2099-10-01"}))
	if len(other.Msg.GetList()) != 0 {
		t.Fatal("date filter must exclude it")
	}

	if _, err := h.HallBookingDelete(ctx, connect.NewRequest(&pb.HallBookingDeleteRequest{Id: id})); err != nil {
		t.Fatal(err)
	}
	_, err = h.HallBookingDelete(ctx, connect.NewRequest(&pb.HallBookingDeleteRequest{Id: id}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("expected NotFound on a second delete, got %v", err)
	}
}

func TestHallBookingCreateMapsErrorsToStatusCodes(t *testing.T) {
	ctx := context.Background()
	h := newTestHallHandler()

	with := func(mutate func(*pb.HallBookingCreateRequest)) *pb.HallBookingCreateRequest {
		r := booking("09:00", "10:00")
		mutate(r)
		return r
	}
	cases := map[string]struct {
		req  *pb.HallBookingCreateRequest
		want connect.Code
	}{
		"no title":       {with(func(r *pb.HallBookingCreateRequest) { r.Title = " " }), connect.CodeInvalidArgument},
		"no organizer":   {with(func(r *pb.HallBookingCreateRequest) { r.Organizer = "" }), connect.CodeInvalidArgument},
		"no contact":     {with(func(r *pb.HallBookingCreateRequest) { r.Contact = "" }), connect.CodeInvalidArgument},
		"bad date":       {with(func(r *pb.HallBookingCreateRequest) { r.Date = "01.09.2099" }), connect.CodeInvalidArgument},
		"past date":      {with(func(r *pb.HallBookingCreateRequest) { r.Date = "2020-01-01" }), connect.CodeInvalidArgument},
		"bad time":       {with(func(r *pb.HallBookingCreateRequest) { r.TimeStart = "9:00" }), connect.CodeInvalidArgument},
		"ends before":    {with(func(r *pb.HallBookingCreateRequest) { r.TimeEnd = "08:30" }), connect.CodeInvalidArgument},
		"before the day": {with(func(r *pb.HallBookingCreateRequest) { r.TimeStart = "07:00" }), connect.CodeInvalidArgument},
		"after the day":  {with(func(r *pb.HallBookingCreateRequest) { r.TimeEnd = "21:00" }), connect.CodeInvalidArgument},
		"unknown hall":   {with(func(r *pb.HallBookingCreateRequest) { r.HallId = 9 }), connect.CodeNotFound},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			_, err := h.HallBookingCreate(ctx, connect.NewRequest(tc.req))
			if connect.CodeOf(err) != tc.want {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
		})
	}
}

func TestHallBookingRejectsOverlaps(t *testing.T) {
	ctx := context.Background()
	h := newTestHallHandler()

	if _, err := h.HallBookingCreate(ctx, connect.NewRequest(booking("10:00", "12:00"))); err != nil {
		t.Fatal(err)
	}

	for _, slot := range [][2]string{{"09:00", "10:30"}, {"11:00", "13:00"}, {"10:30", "11:30"}, {"09:00", "13:00"}} {
		_, err := h.HallBookingCreate(ctx, connect.NewRequest(booking(slot[0], slot[1])))
		if connect.CodeOf(err) != connect.CodeAlreadyExists {
			t.Fatalf("%s–%s overlaps 10:00–12:00 and must be AlreadyExists, got %v", slot[0], slot[1], err)
		}
	}

	// Back-to-back bookings touch but don't overlap.
	for _, slot := range [][2]string{{"08:00", "10:00"}, {"12:00", "13:00"}} {
		if _, err := h.HallBookingCreate(ctx, connect.NewRequest(booking(slot[0], slot[1]))); err != nil {
			t.Fatalf("%s–%s is adjacent, not overlapping: %v", slot[0], slot[1], err)
		}
	}
}
