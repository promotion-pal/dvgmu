package models

import (
	"errors"
	"strings"
	"testing"
	"time"

	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"
)

func validTimetable() *entity.ScheduleTimetable {
	return &entity.ScheduleTimetable{
		Title:    "Лечебное дело, 1 курс",
		Faculty:  "Лечебный факультет",
		Program:  &entity.ScheduleProgram{Id: "lech", Code: "31.05.01", Name: "Лечебное дело"},
		Course:   1,
		Semester: &entity.ScheduleSemester{Label: "Осень 2026/27", Start: "2026-09-01", End: "2026-12-31"},
		Groups:   []string{"101", "102"},
		Slots: []*entity.ScheduleSlot{
			{Id: "s1", Start: "08:30", End: "10:10"},
			{Id: "s2", Start: "10:20", End: "12:00"},
		},
		Subjects: []*entity.ScheduleSubject{{Id: "anat", Name: "Анатомия"}},
		Entries: []*entity.ScheduleEntry{{
			Id: "e1", Weekday: 1, SlotId: "s1", Span: 2, GroupIds: []string{"101"}, SubjectId: "anat",
		}},
		Periods: []*entity.SchedulePeriod{{
			Id: "p1", Kind: enum.SchedulePeriodKind_SCHEDULE_PERIOD_KIND_STUDY,
			Label: "Учёба", From: "2026-09-01", To: "2026-12-20",
		}},
	}
}

func TestScheduleValidateAcceptsAWellFormedTimetable(t *testing.T) {
	if err := ScheduleValidate(validTimetable()); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
	timetable := validTimetable()
	timetable.Slots[1].Start = timetable.Slots[0].End
	if err := ScheduleValidate(timetable); err != nil {
		t.Fatalf("expected adjacent slots to be valid, got %v", err)
	}
}

func TestScheduleValidateRejects(t *testing.T) {
	cases := map[string]struct {
		mutate func(*entity.ScheduleTimetable)
		want   string
	}{
		"empty title":          {func(t *entity.ScheduleTimetable) { t.Title = " " }, "название расписания"},
		"no program":           {func(t *entity.ScheduleTimetable) { t.Program = nil }, "специальность"},
		"course zero":          {func(t *entity.ScheduleTimetable) { t.Course = 0 }, "курс"},
		"bad semester date":    {func(t *entity.ScheduleTimetable) { t.Semester.Start = "01.09.2026" }, "начало семестра"},
		"semester reversed":    {func(t *entity.ScheduleTimetable) { t.Semester.End = "2026-08-01" }, "раньше"},
		"no groups":            {func(t *entity.ScheduleTimetable) { t.Groups = nil }, "группу"},
		"duplicate group":      {func(t *entity.ScheduleTimetable) { t.Groups = []string{"101", "101"} }, "дважды"},
		"no slots":             {func(t *entity.ScheduleTimetable) { t.Slots = nil }, "пару"},
		"bad slot time":        {func(t *entity.ScheduleTimetable) { t.Slots[0].Start = "8-30" }, "ЧЧ:ММ"},
		"slot ends first":      {func(t *entity.ScheduleTimetable) { t.Slots[0].End = "08:00" }, "раньше"},
		"overlapping slots":    {func(t *entity.ScheduleTimetable) { t.Slots[1].Start = "10:00" }, "окончания пары"},
		"out of order slots":   {func(t *entity.ScheduleTimetable) { t.Slots[0], t.Slots[1] = t.Slots[1], t.Slots[0] }, "окончания пары"},
		"duplicate subject":    {func(t *entity.ScheduleTimetable) { t.Subjects = append(t.Subjects, t.Subjects[0]) }, "дважды"},
		"weekday out of range": {func(t *entity.ScheduleTimetable) { t.Entries[0].Weekday = 8 }, "день недели"},
		"unknown slot":         {func(t *entity.ScheduleTimetable) { t.Entries[0].SlotId = "s9" }, "сетке"},
		"span past the grid":   {func(t *entity.ScheduleTimetable) { t.Entries[0].SlotId = "s2" }, "выходит"},
		"unknown subject":      {func(t *entity.ScheduleTimetable) { t.Entries[0].SubjectId = "x" }, "предмета"},
		"unknown group":        {func(t *entity.ScheduleTimetable) { t.Entries[0].GroupIds = []string{"999"} }, "группы"},
		"no entry groups":      {func(t *entity.ScheduleTimetable) { t.Entries[0].GroupIds = nil }, "группу"},
		"bad entry date":       {func(t *entity.ScheduleTimetable) { t.Entries[0].Dates = []string{"2026-13-40"} }, "дата"},
		"bad starts at":        {func(t *entity.ScheduleTimetable) { t.Entries[0].StartsAt = "25:00" }, "начала"},
		"period reversed":      {func(t *entity.ScheduleTimetable) { t.Periods[0].To = "2026-08-01" }, "раньше"},
		"period without kind":  {func(t *entity.ScheduleTimetable) { t.Periods[0].Kind = 0 }, "тип"},
		"periods share a date": {func(t *entity.ScheduleTimetable) {
			t.Periods = append([]*entity.SchedulePeriod{{
				Id: "p2", Kind: enum.SchedulePeriodKind_SCHEDULE_PERIOD_KIND_SESSION,
				Label: "Сессия", From: "2026-12-20", To: "2026-12-31",
			}}, t.Periods...)
		}, "пересекаются"},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			tt := validTimetable()
			tc.mutate(tt)
			err := ScheduleValidate(tt)
			if !errors.Is(err, ErrScheduleInvalid) {
				t.Fatalf("expected ErrScheduleInvalid, got %v", err)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected the message to mention %q, got %q", tc.want, err.Error())
			}
		})
	}
}

func TestScheduleNormalizeFillsImplicitDefaults(t *testing.T) {
	tt := validTimetable()
	tt.Entries[0].Span = 0
	ScheduleNormalize(tt)

	e := tt.Entries[0]
	if e.Span != 1 || e.Kind != enum.ScheduleEntryKind_SCHEDULE_ENTRY_KIND_PRACTICE || e.Weeks != enum.ScheduleWeeks_SCHEDULE_WEEKS_EVERY {
		t.Fatalf("defaults not applied: %+v", e)
	}
}

func TestScheduleRoundTripKeepsTheAggregate(t *testing.T) {
	tt := validTimetable()
	tt.Id = "abc"
	tt.Entries[0].Dates = []string{"2026-09-02", "2026-09-16"}

	s, err := NewSchedule(tt)
	if err != nil {
		t.Fatal(err)
	}
	if s.ProgramID != "lech" || s.Course != 1 || s.SemesterStart != "2026-09-01" {
		t.Fatalf("columns not lifted: %+v", s)
	}
	if strings.Contains(s.Body, `"id":"abc"`) || strings.Contains(s.Body, "created_at") {
		t.Fatalf("id/timestamps must live in columns only: %s", s.Body)
	}

	s.CreatedAt = time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)
	got, err := s.ToProto()
	if err != nil {
		t.Fatal(err)
	}
	if got.Id != "abc" || got.Title != tt.Title || len(got.Entries) != 1 || len(got.Entries[0].Dates) != 2 {
		t.Fatalf("lost data on the round trip: %+v", got)
	}
}

func TestScheduleCollectValidate(t *testing.T) {
	valid := func() *entity.ScheduleCollectEntry {
		return &entity.ScheduleCollectEntry{
			Day: 1, Les: 1, Aud: "101", Name: "доц. Иванов И.И.",
			Subject: "Анатомия", SubjType: "л.", Date: "2026-09-01",
		}
	}
	if err := ScheduleCollectValidate(valid()); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}

	e := valid()
	e.SubstitutionName = "доц. Петров П.П."
	if err := ScheduleCollectValidate(e); !errors.Is(err, ErrScheduleCollectInvalid) || !strings.Contains(err.Error(), "замена") {
		t.Fatalf("a partial substitution must be rejected, got %v", err)
	}
}

func validCycleTimetable() *entity.ScheduleTimetable {
	return &entity.ScheduleTimetable{
		Title:    "Лечебное дело, 4 курс",
		Program:  &entity.ScheduleProgram{Id: "31.05.01", Code: "31.05.01", Name: "Лечебное дело"},
		Course:   4,
		Format:   enum.ScheduleFormat_SCHEDULE_FORMAT_CYCLES,
		Semester: &entity.ScheduleSemester{Label: "Осень 2026/27", Start: "2026-09-01", End: "2027-01-20"},
		Groups:   []string{"401", "402"},
		Subjects: []*entity.ScheduleSubject{{Id: "uro", Name: "Урология"}},
		Lectures: []*entity.ScheduleLecture{{
			Id: "l1", SubjectId: "uro", Start: "10:40", End: "12:20", Dates: []string{"2026-09-16"}, Room: "Зал № 3",
		}, {
			Id: "l2", SubjectId: "uro", Start: "12:50", End: "14:30", Dates: []string{"2026-09-19"}, Remote: true,
		}},
		Cycles: []*entity.ScheduleCycle{{Id: "c1", SubjectId: "uro", GroupIds: []string{"401", "402"}, From: "2026-10-05", To: "2026-10-13"}},
	}
}

func TestScheduleValidateAcceptsACycleTimetable(t *testing.T) {
	if err := ScheduleValidate(validCycleTimetable()); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
}

func TestScheduleValidateRejectsCycles(t *testing.T) {
	cases := map[string]struct {
		mutate func(*entity.ScheduleTimetable)
		want   string
	}{
		"weekly entries":      {func(t *entity.ScheduleTimetable) { t.Entries = validTimetable().Entries }, "сеткой пар"},
		"cycles in weekly":    {func(t *entity.ScheduleTimetable) { t.Format = enum.ScheduleFormat_SCHEDULE_FORMAT_WEEKLY }, "только в расписании циклами"},
		"lecture no dates":    {func(t *entity.ScheduleTimetable) { t.Lectures[0].Dates = nil }, "дату"},
		"lecture no room":     {func(t *entity.ScheduleTimetable) { t.Lectures[0].Room = "" }, "ДОТ"},
		"lecture reversed":    {func(t *entity.ScheduleTimetable) { t.Lectures[0].End = "10:00" }, "раньше"},
		"lecture bad subject": {func(t *entity.ScheduleTimetable) { t.Lectures[0].SubjectId = "x" }, "предмета"},
		"cycle reversed":      {func(t *entity.ScheduleTimetable) { t.Cycles[0].To = "2026-10-01" }, "раньше"},
		"cycle unknown group": {func(t *entity.ScheduleTimetable) { t.Cycles[0].GroupIds = []string{"999"} }, "группы"},
		"cycle no groups":     {func(t *entity.ScheduleTimetable) { t.Cycles[0].GroupIds = nil }, "группу"},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			tt := validCycleTimetable()
			tc.mutate(tt)
			err := ScheduleValidate(tt)
			if !errors.Is(err, ErrScheduleInvalid) || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected ErrScheduleInvalid mentioning %q, got %v", tc.want, err)
			}
		})
	}
}
