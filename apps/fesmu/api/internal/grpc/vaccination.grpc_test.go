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

// memoryVaccinationStorage applies the same rules as the gorm storage.
type memoryVaccinationStorage struct {
	nextID  int64
	days    map[int64]*models.VaccinationDay
	slots   map[int64]*models.VaccinationSlot
	signups map[int64]*models.VaccinationSignup
}

func (m *memoryVaccinationStorage) id() int64 { m.nextID++; return m.nextID }

func (m *memoryVaccinationStorage) VaccinationDayFetch(_ context.Context, dateFrom string) ([]*models.VaccinationDay, error) {
	var out []*models.VaccinationDay
	for _, d := range m.days {
		if dateFrom != "" && d.Date < dateFrom {
			continue
		}
		copyDay := *d
		copyDay.Slots = nil
		for _, s := range d.Slots {
			slot := *m.slots[s.ID]
			slot.Signups = nil
			for _, sg := range m.signups {
				if sg.SlotID == slot.ID {
					slot.Signups = append(slot.Signups, *sg)
				}
			}
			copyDay.Slots = append(copyDay.Slots, slot)
		}
		out = append(out, &copyDay)
	}
	return out, nil
}

func (m *memoryVaccinationStorage) VaccinationDayCreate(_ context.Context, d *models.VaccinationDay) (int64, error) {
	d.ID = m.id()
	for i := range d.Slots {
		d.Slots[i].ID, d.Slots[i].DayID = m.id(), d.ID
		slot := d.Slots[i]
		m.slots[slot.ID] = &slot
	}
	m.days[d.ID] = d
	return d.ID, nil
}

func (m *memoryVaccinationStorage) VaccinationDayDelete(_ context.Context, id int64) error {
	if _, ok := m.days[id]; !ok {
		return models.ErrVaccinationDayNotFound
	}
	delete(m.days, id)
	return nil
}

func (m *memoryVaccinationStorage) VaccinationSignupCreate(_ context.Context, s *models.VaccinationSignup, today string) (int64, error) {
	slot, ok := m.slots[s.SlotID]
	if !ok || m.days[slot.DayID].Date < today {
		return 0, models.ErrVaccinationSlotNotFound
	}
	taken := 0
	for _, other := range m.signups {
		if other.SlotID == slot.ID {
			taken++
		}
		if other.DayID == slot.DayID && other.NameKey == s.NameKey {
			return 0, models.ErrVaccinationAlreadySignedUp
		}
	}
	if taken >= int(slot.Capacity) {
		return 0, models.ErrVaccinationSlotFull
	}
	s.ID, s.DayID = m.id(), slot.DayID
	m.signups[s.ID] = s
	return s.ID, nil
}

func (m *memoryVaccinationStorage) VaccinationSignupDelete(_ context.Context, id int64) error {
	if _, ok := m.signups[id]; !ok {
		return models.ErrVaccinationSignupNotFound
	}
	delete(m.signups, id)
	return nil
}

func newTestVaccinationHandler() *VaccinationHandler {
	store := &memoryVaccinationStorage{
		days: map[int64]*models.VaccinationDay{}, slots: map[int64]*models.VaccinationSlot{}, signups: map[int64]*models.VaccinationSignup{},
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return VaccinationNewController(service.NewVaccinationService(log, store, store))
}

func TestVaccinationSignupRules(t *testing.T) {
	ctx := context.Background()
	h := newTestVaccinationHandler()

	created, err := h.VaccinationDayCreate(ctx, connect.NewRequest(&pb.VaccinationDayCreateRequest{Date: "2099-10-12", Title: "Вакцинация против гриппа"}))
	if err != nil {
		t.Fatal(err)
	}
	days, _ := h.VaccinationDayFetch(ctx, connect.NewRequest(&pb.VaccinationDayFetchRequest{}))
	if len(days.Msg.GetList()) != 1 || days.Msg.GetList()[0].GetId() != created.Msg.GetVaccinationDayId() || len(days.Msg.GetList()[0].GetSlots()) != 4 {
		t.Fatalf("expected one day with 4 slots, got %v", days.Msg.GetList())
	}
	first := days.Msg.GetList()[0].GetSlots()[0].GetId()
	second := days.Msg.GetList()[0].GetSlots()[1].GetId()

	signup := func(slot int64, name string) error {
		_, err := h.VaccinationSignupCreate(ctx, connect.NewRequest(&pb.VaccinationSignupCreateRequest{SlotId: slot, FullName: name, PersonalDataConsent: true}))
		return err
	}

	for i := 0; i < 12; i++ {
		if err := signup(first, "Студент Номер "+string(rune('А'+i))); err != nil {
			t.Fatalf("place %d: %v", i+1, err)
		}
	}
	if err := signup(first, "Тринадцатый Студент Иванович"); connect.CodeOf(err) != connect.CodeResourceExhausted {
		t.Fatalf("13th person in a 12-place slot must be ResourceExhausted, got %v", err)
	}
	if err := signup(second, "студент  номер а"); connect.CodeOf(err) != connect.CodeAlreadyExists {
		t.Fatalf("the same person twice on one day must be AlreadyExists, got %v", err)
	}
	if err := signup(second, "Иванов"); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("a surname alone must be InvalidArgument, got %v", err)
	}
	if err := signup(9999, "Иванов Иван Иванович"); connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("unknown slot must be NotFound, got %v", err)
	}

	days, _ = h.VaccinationDayFetch(ctx, connect.NewRequest(&pb.VaccinationDayFetchRequest{}))
	if got := len(days.Msg.GetList()[0].GetSlots()[0].GetSignups()); got != 12 {
		t.Fatalf("names must be listed right away, got %d", got)
	}
}

func TestVaccinationPastDayIsClosed(t *testing.T) {
	ctx := context.Background()
	h := newTestVaccinationHandler()
	if _, err := h.VaccinationDayCreate(ctx, connect.NewRequest(&pb.VaccinationDayCreateRequest{Date: "2020-01-10", Title: "Прошедшая"})); err != nil {
		t.Fatal(err)
	}
	days, _ := h.VaccinationDayFetch(ctx, connect.NewRequest(&pb.VaccinationDayFetchRequest{}))
	slot := days.Msg.GetList()[0].GetSlots()[0].GetId()
	_, err := h.VaccinationSignupCreate(ctx, connect.NewRequest(&pb.VaccinationSignupCreateRequest{SlotId: slot, FullName: "Иванов Иван Иванович", PersonalDataConsent: true}))
	if connect.CodeOf(err) != connect.CodeNotFound {
		t.Fatalf("signing up for a past day must be refused, got %v", err)
	}
}
