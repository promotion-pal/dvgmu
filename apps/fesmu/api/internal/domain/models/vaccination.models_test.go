package models

import (
	"errors"
	"testing"
	"time"
)

func TestNewVaccinationDayGetsDefaultSlots(t *testing.T) {
	day, err := NewVaccinationDay(VaccinationDayParams{Date: "2026-10-12", Title: "Вакцинация против гриппа"}, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	want := [][2]string{{"10:00", "10:30"}, {"10:30", "11:00"}, {"11:00", "11:30"}, {"11:30", "12:00"}}
	if len(day.Slots) != len(want) {
		t.Fatalf("expected %d slots, got %d", len(want), len(day.Slots))
	}
	for i, slot := range day.Slots {
		if slot.TimeStart != want[i][0] || slot.TimeEnd != want[i][1] || slot.Capacity != 12 {
			t.Fatalf("slot %d: %+v", i, slot)
		}
	}
	day.Slots[0].Capacity = 1
	if DefaultVaccinationSlots[0].Capacity != 12 {
		t.Fatal("a day's slots must be a copy of the defaults")
	}
}

func TestNewVaccinationSignup(t *testing.T) {
	cases := map[string]struct {
		name    string
		consent bool
		ok      bool
	}{
		"full name":      {"Иванов Иван Иванович", true, true},
		"surname only":   {"Иванов", true, false},
		"no consent":     {"Иванов Иван Иванович", false, false},
		"spaces trimmed": {"  Иванов   Иван ", true, true},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			s, err := NewVaccinationSignup(1, tc.name, tc.consent, time.Now())
			if tc.ok != (err == nil) {
				t.Fatalf("expected ok=%v, got %v", tc.ok, err)
			}
			if err != nil && !errors.Is(err, ErrVaccinationInvalid) {
				t.Fatalf("expected ErrVaccinationInvalid, got %v", err)
			}
			if err == nil && s.FullName != "Иванов Иван"+map[bool]string{true: " Иванович", false: ""}[tc.name == "Иванов Иван Иванович"] {
				t.Fatalf("name not normalized: %q", s.FullName)
			}
		})
	}
}

func TestVaccinationNameKeyMatchesTheSamePerson(t *testing.T) {
	a := VaccinationNameKey("Семёнов  Пётр Иванович")
	b := VaccinationNameKey("семенов петр иванович")
	if a != b {
		t.Fatalf("%q != %q", a, b)
	}
}
