package service

import (
	"slices"
	"testing"
	"time"

	"dvgmu/schedula/internal/domain/models"
	"dvgmu/schedula/internal/storage"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
)

func TestConflictUsesIntervalsAndAudience(t *testing.T) {
	day, _ := date("2026-11-24")
	room := models.Room{ID: "a", SiteID: "main", Capacity: 30, OpensAt: 480, ClosesAt: 1140}
	event := models.Event{
		ID: "first", Date: &day, StartMinute: new(int32(540)), DurationMinutes: 90,
		RoomID: &room.ID, Room: room, ExpectedAttendance: 20, InstructorID: "instructor",
		Audiences: []models.Audience{{Group: "402", Subgroup: "A", Course: 4}},
	}
	other := event
	other.ID = "second"
	other.StartMinute = new(int32(600))
	checks := catalog{travel: map[[2]string]int32{{"main", "clinic"}: 20}}
	for _, start := range []int32{540, 600} {
		other.StartMinute = &start
		issues := checks.check(event, []models.Event{other}, false)
		for _, kind := range []scheduleenum.IssueType{scheduleenum.IssueType_ISSUE_TYPE_GROUP, scheduleenum.IssueType_ISSUE_TYPE_INSTRUCTOR, scheduleenum.IssueType_ISSUE_TYPE_ROOM} {
			if !slices.ContainsFunc(issues, func(issue *pb.Issue) bool {
				return issue.Type == kind && issue.Event.Id == event.ID && issue.ConflictingEvent.GetId() == other.ID &&
					issue.ConflictingEvent.GetStartMinute() == start
			}) {
				t.Fatalf("start %d, missing %s: %v", start, kind, issues)
			}
		}
	}
	other.StartMinute = new(int32(630))
	if issues := checks.check(event, []models.Event{other}, false); len(issues) != 0 {
		t.Fatalf("adjacent events in one room: %v", issues)
	}

	other.Room = models.Room{ID: "b", SiteID: "clinic"}
	other.RoomID = &other.Room.ID
	other.Audiences = []models.Audience{{Group: "402", Subgroup: "B", Course: 4}}
	other.InstructorID = "another"
	other.StartMinute = new(int32(600))
	if issues := checks.check(event, []models.Event{other}, false); len(issues) != 0 {
		t.Fatalf("different subgroups and resources: %v", issues)
	}
	other.Audiences[0].Subgroup = ""
	other.StartMinute = new(int32(640))
	issues := checks.check(event, []models.Event{other}, false)
	if len(issues) != 1 || issues[0].Type != scheduleenum.IssueType_ISSUE_TYPE_TRAVEL {
		t.Fatalf("expected insufficient travel time for the whole group: %v", issues)
	}
}

func TestTravelOnlyBetweenConsecutiveLessons(t *testing.T) {
	day, _ := date("2026-11-24")
	group := models.Audience{Group: "402", Course: 4}
	subgroup := models.Audience{Group: "402", Subgroup: "A", Course: 4}
	lesson := func(id, site string, start int32, audience models.Audience) models.Event {
		room := models.Room{ID: site, SiteID: site, Capacity: 30, OpensAt: 480, ClosesAt: 1140}
		return models.Event{
			ID: id, Date: &day, StartMinute: &start, DurationMinutes: 30,
			RoomID: &room.ID, Room: room, ExpectedAttendance: 20, InstructorID: "teacher",
			Audiences: []models.Audience{audience},
		}
	}
	first := lesson("first", "a", 540, group)
	middle := lesson("middle", "b", 575, subgroup)
	last := lesson("last", "c", 615, subgroup)
	c := catalog{travel: map[[2]string]int32{{"a", "b"}: 5, {"b", "c"}: 10, {"a", "c"}: 60}}
	if issues := c.check(first, []models.Event{middle, last}, false); len(issues) != 0 {
		t.Fatalf("non-consecutive lessons for both group and teacher: %v", issues)
	}
	otherTeacher := middle
	otherTeacher.InstructorID = "another"
	cancelledMiddle := middle
	cancelledMiddle.Status = cancelled
	for _, tc := range []struct {
		name   string
		middle models.Event
		last   models.Event
	}{
		{"teacher remains consecutive", otherTeacher, last},
		{"other subgroups remain consecutive", middle, lesson("last", "c", 615, group)},
		{"cancelled lesson does not interrupt travel", cancelledMiddle, last},
	} {
		t.Run(tc.name, func(t *testing.T) {
			issues := c.check(first, []models.Event{tc.middle, tc.last}, false)
			if len(issues) != 1 || issues[0].Type != scheduleenum.IssueType_ISSUE_TYPE_TRAVEL || issues[0].ConflictingEvent.GetId() != last.ID {
				t.Fatalf("expected travel conflict with last lesson: %v", issues)
			}
		})
	}
}

func TestTravelDistinguishesMissingNormFromZero(t *testing.T) {
	day, _ := date("2026-11-24")
	lesson := func(id, site string, start int32) models.Event {
		room := models.Room{ID: id, SiteID: site, Capacity: 30, OpensAt: 480, ClosesAt: 1140}
		return models.Event{
			ID: id, Date: &day, StartMinute: &start, DurationMinutes: 30,
			RoomID: &room.ID, Room: room, ExpectedAttendance: 20, InstructorID: "teacher",
		}
	}
	first := lesson("first", "main", 540)
	second := lesson("second", "clinic", 580)
	for _, tc := range []struct {
		name    string
		travel  map[[2]string]int32
		kind    scheduleenum.IssueType
		message string
	}{
		{name: "missing", kind: scheduleenum.IssueType_ISSUE_TYPE_TRAVEL_NORM_MISSING, message: "Переход не проверен: между площадками не указан норматив, доступно 10 мин"},
		{name: "only reverse direction", travel: map[[2]string]int32{{"clinic", "main"}: 0}, kind: scheduleenum.IssueType_ISSUE_TYPE_TRAVEL_NORM_MISSING, message: "Переход не проверен: между площадками не указан норматив, доступно 10 мин"},
		{name: "explicit zero", travel: map[[2]string]int32{{"main", "clinic"}: 0}},
		{name: "exact norm", travel: map[[2]string]int32{{"main", "clinic"}: 10}},
		{name: "too short", travel: map[[2]string]int32{{"main", "clinic"}: 15}, kind: scheduleenum.IssueType_ISSUE_TYPE_TRAVEL, message: "На переход 10 мин, требуется 15 мин"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			issues := (catalog{travel: tc.travel}).check(second, []models.Event{first}, false)
			if tc.message == "" {
				if len(issues) != 0 {
					t.Fatalf("unexpected issue: %v", issues)
				}
				return
			}
			if len(issues) != 1 || issues[0].Type != tc.kind ||
				issues[0].Message != tc.message || issues[0].Event.GetId() != second.ID || issues[0].ConflictingEvent.GetId() != first.ID {
				t.Fatalf("wrong travel issue: %v", issues)
			}
		})
	}
	second.Room.SiteID = first.Room.SiteID
	if issues := (catalog{}).check(second, []models.Event{first}, false); len(issues) != 0 {
		t.Fatalf("different rooms in the same site do not need a norm: %v", issues)
	}
}

func TestGroupPeriodRestrictsPlacementAndSupportsSubgroupOverride(t *testing.T) {
	day, _ := date("2026-11-24")
	room := models.Room{
		ID: "clinic-1", Capacity: 30, OpensAt: 480, ClosesAt: 1140,
		Site: models.Site{Clinical: true, Address: "Адрес"},
	}
	practice := models.AcademicPeriod{
		ID: "practice", TermID: "term", Group: "301", Course: 3,
		Type: scheduleenum.PeriodType_PERIOD_TYPE_PRACTICE, DateFrom: day.AddDate(0, 0, -1), DateTo: day,
	}
	exams := models.AcademicPeriod{
		ID: "exam", TermID: "term", Group: "301", Subgroup: "B", Course: 3,
		Type: scheduleenum.PeriodType_PERIOD_TYPE_EXAMS, DateFrom: day, DateTo: day,
	}
	c := catalogFromRows(storage.Catalog{Periods: []models.AcademicPeriod{practice, exams}})
	event := models.Event{
		TermID: "term", Date: &day, StartMinute: new(int32(540)), DurationMinutes: 90,
		Room: room, RoomID: &room.ID, ExpectedAttendance: 15, InstructorID: "instructor",
		Department: "Кафедра", MeetingPoint: "Вход",
	}
	for _, tc := range []struct {
		name     string
		subgroup string
		kind     scheduleenum.EventType
		problem  string
	}{
		{"third-year clinical day", "A", scheduleenum.EventType_EVENT_TYPE_CLINICAL_CYCLE, ""},
		{"lecture during inherited practice", "A", scheduleenum.EventType_EVENT_TYPE_LECTURE, "301 / A: в этот день по учебному графику проходит практика"},
		{"exam in subgroup override", "B", scheduleenum.EventType_EVENT_TYPE_EXAM, ""},
		{"clinical day in subgroup exams", "B", scheduleenum.EventType_EVENT_TYPE_CLINICAL_CYCLE, "301 / B: в этот день по учебному графику проходит сессия"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			event.Type = tc.kind
			event.Audiences = []models.Audience{{Group: "301", Subgroup: tc.subgroup, Course: 3}}
			issues := c.check(event, nil, false)
			if tc.problem == "" {
				if len(issues) != 0 {
					t.Fatalf("unexpected issue: %v", issues)
				}
			} else if len(issues) != 1 || issues[0].Type != scheduleenum.IssueType_ISSUE_TYPE_AVAILABILITY || issues[0].Message != tc.problem {
				t.Fatalf("unexpected placement result: %v", issues)
			}
		})
	}
}

func TestSlotOrderUsesTimeAndOffersAlternativeRoom(t *testing.T) {
	day, _ := date("2026-11-24")
	late := models.Room{ID: "late", Capacity: 30, OpensAt: 780, ClosesAt: 1140}
	early := models.Room{ID: "early", Capacity: 30, OpensAt: 480, ClosesAt: 720}
	backup := models.Room{ID: "backup", Capacity: 30, OpensAt: 480, ClosesAt: 720}
	c := catalog{}
	c.Rooms = []models.Room{late, early, backup}
	details := models.Event{DurationMinutes: 60, ExpectedAttendance: 20, InstructorID: "teacher"}
	result := c.availableSlots(details, models.Event{}, day, day, nil)
	if len(result.Slots) == 0 || result.Slots[0].StartMinute != 480 || result.Slots[0].Room.Id != early.ID {
		t.Fatalf("expected earliest slot across rooms: %v", result)
	}
	original := details
	original.ID, original.Date, original.StartMinute, original.Room = "original", &day, new(int32(557)), early
	details.ID = original.ID
	result = c.availableSlots(details, original, day, day, nil)
	if len(result.Slots) < 2 || result.Slots[0].StartMinute != 557 || result.Slots[0].Room.Id != backup.ID ||
		result.Slots[1].StartMinute != 555 || result.Slots[1].Room.Id != early.ID {
		t.Fatalf("expected an alternative room at the original time, then nearest time: %v", result)
	}
}

func TestRecurrenceUsesAcademicWeek(t *testing.T) {
	termStart, _ := date("2026-09-01")
	from, _ := date("2026-11-23")
	to, _ := date("2027-01-30")
	events, err := expand(models.Event{ID: "series", Date: &from}, &pb.Series{
		Recurrence: scheduleenum.Recurrence_RECURRENCE_EVEN, DateTo: "2026-12-14",
		Slots: []*pb.WeeklySlot{
			{Weekday: 1, StartMinute: 540, DurationMinutes: 90},
			{Weekday: 3, StartMinute: 630, DurationMinutes: 120},
		},
	}, models.Term{DateFrom: termStart, DateTo: to})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"2026-11-30", "2026-12-02", "2026-12-14"}
	if len(events) != len(want) {
		t.Fatalf("got %d dates, want %d", len(events), len(want))
	}
	for i, event := range events {
		if event.Date.Format(time.DateOnly) != want[i] || event.SeriesID == nil || *event.SeriesID != "series" {
			t.Fatalf("event %d: %+v", i, event)
		}
	}
	if events[0].EndMinute() != 630 || events[1].EndMinute() != 750 {
		t.Fatalf("wrong end times: %d, %d", events[0].EndMinute(), events[1].EndMinute())
	}
}

func TestSeriesRejectsOverlappingWeeklySlots(t *testing.T) {
	from, _ := date("2026-11-23")
	term := models.Term{DateFrom: from, DateTo: from.AddDate(0, 0, 7)}
	event := models.Event{Date: &from}
	series := &pb.Series{
		Recurrence: scheduleenum.Recurrence_RECURRENCE_WEEKLY, DateTo: "2026-11-29",
		Slots: []*pb.WeeklySlot{
			{Weekday: 1, StartMinute: 540, DurationMinutes: 90},
			{Weekday: 1, StartMinute: 540, DurationMinutes: 90},
		},
	}
	for _, start := range []int32{540, 600} {
		series.Slots[1].StartMinute = start
		if _, err := expand(event, series, term); err == nil {
			t.Fatalf("accepted overlapping slot at minute %d", start)
		}
	}
	series.Slots[1].StartMinute = 630
	if events, err := expand(event, series, term); err != nil || len(events) != 2 {
		t.Fatalf("expected two adjacent slots, got %v: %v", events, err)
	}
}
