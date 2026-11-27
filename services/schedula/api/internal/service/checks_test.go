package service

import (
	"slices"
	"testing"
	"time"

	"dvgmu/schedula/internal/domain/models"
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
