package grpc_test

import (
	"context"
	"slices"
	"testing"
	"time"

	"connectrpc.com/connect"

	"dvgmu/schedula/internal/service"
	"dvgmu/schedula/internal/storage"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
	rpc "fesmu/contract/schedula/service"
)

func TestPersistedCalendarChecksAndCompleteness(t *testing.T) {
	db := testDatabase(t)(t)
	ctx := t.Context()
	schedule := service.New(storage.New(db), time.UTC, func(context.Context) ([]service.Group, error) {
		return []service.Group{{Code: "301", Course: 3, Count: 20}, {Code: "401", Course: 4, Count: 20}}, nil
	})
	actor := service.Actor{ID: "editor", CanReviewChanges: true}
	main, clinic := &pb.Site{Id: "main", Name: "Корпус", Address: "Адрес"}, &pb.Site{Id: "clinic", Name: "База", Address: "Адрес", Clinical: true}
	if err := schedule.SaveCatalog(ctx, &pb.Catalog{
		Terms:    []*pb.Term{{Id: "term", Name: "Семестр", DateFrom: "2026-09-01", DateTo: "2027-01-31"}},
		Subjects: []*pb.Subject{{Id: "subject", Name: "Дисциплина"}},
		Sites:    []*pb.Site{main, clinic},
		Rooms: []*pb.Room{
			{Id: "a", Site: main, Name: "Аудитория", Capacity: 30, OpensAt: 480, ClosesAt: 1140},
			{Id: "b", Site: clinic, Name: "Практикум", Capacity: 30, OpensAt: 480, ClosesAt: 1140},
		},
	}); err != nil {
		t.Fatal(err)
	}
	save := func(day, room string, start int32) *pb.Event {
		t.Helper()
		events, err := schedule.Save(ctx, &rpc.EventSaveRequest{Details: &pb.EventInput{
			TermId: "term", SubjectId: "subject", Type: scheduleenum.EventType_EVENT_TYPE_LECTURE,
			Audiences: []*pb.Audience{{Group: "301", Course: 3}}, InstructorId: "teacher",
			Date: day, StartMinute: &start, DurationMinutes: 30, RoomId: room,
		}}, actor)
		if err != nil || len(events) != 1 {
			t.Fatalf("save draft: %v %v", events, err)
		}
		return events[0]
	}
	publish := func(event *pb.Event) *rpc.EventPublishResponse {
		t.Helper()
		result, err := schedule.Publish(ctx, &rpc.EventPublishRequest{Id: event.Id, Revision: event.Revision})
		if err != nil {
			t.Fatal(err)
		}
		return result
	}
	first := save("2026-11-24", "a", 540)
	if result := publish(first); len(result.Events) != 1 {
		t.Fatalf("publish first event: %v", result)
	}
	second := save("2026-11-24", "b", 580)
	const missingNorm = scheduleenum.IssueType_ISSUE_TYPE_TRAVEL_NORM_MISSING
	slots, err := schedule.Slots(ctx, &rpc.SlotsFetchRequest{
		Details: second.Details, DateFrom: "2026-11-24", DateTo: "2026-11-24",
	}, false)
	if err != nil || len(slots.Slots) != 0 || !slices.ContainsFunc(slots.Issues, func(issue *pb.Issue) bool { return issue.Type == missingNorm }) {
		t.Fatalf("slot with unchecked travel must be excluded: %v %v", slots, err)
	}
	result := publish(second)
	if len(result.Events) != 1 || len(result.Issues) != 1 ||
		result.Issues[0].Type != missingNorm || result.Issues[0].ConflictingEvent.GetId() != first.Id {
		t.Fatalf("missing norm must warn without blocking manual publication: %v", result)
	}
	change, err := schedule.CreateChange(ctx, &rpc.ChangeCreateRequest{
		EventId: second.Id, Revision: result.Events[0].Revision, Type: scheduleenum.ChangeType_CHANGE_TYPE_MOVE,
		Date: "2026-11-24", StartMinute: new(int32(585)), Reason: "Изменилось время",
	}, actor)
	if err != nil || change.Change == nil || len(change.Issues) != 1 || change.Issues[0].Type != missingNorm {
		t.Fatalf("missing norm must warn without blocking request creation: %v %v", change, err)
	}
	decision, err := schedule.DecideChange(ctx, &rpc.ChangeDecideRequest{Id: change.Change.Id, Approve: true}, actor)
	if err != nil || decision.Change.GetStatus() != scheduleenum.ChangeStatus_CHANGE_STATUS_APPROVED ||
		len(decision.Issues) != 1 || decision.Issues[0].Type != missingNorm {
		t.Fatalf("missing norm must warn without blocking request approval: %v %v", decision, err)
	}

	period := &pb.AcademicPeriod{
		Id: "practice", TermId: "term", Type: scheduleenum.PeriodType_PERIOD_TYPE_PRACTICE,
		Audience: &pb.Audience{Group: "301", Course: 3}, DateFrom: "2026-11-25", DateTo: "2026-11-26",
	}
	if err := schedule.SaveCatalog(ctx, &pb.Catalog{Periods: []*pb.AcademicPeriod{period}}); err != nil {
		t.Fatal(err)
	}
	exams := &pb.AcademicPeriod{
		Id: "exams", TermId: "term", Type: scheduleenum.PeriodType_PERIOD_TYPE_EXAMS,
		Audience: period.Audience, DateFrom: "2026-11-26", DateTo: "2026-11-28",
	}
	if err := schedule.SaveCatalog(ctx, &pb.Catalog{Periods: []*pb.AcademicPeriod{exams}}); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("periods sharing a boundary date: %v", err)
	}
	lecture := save("2026-11-26", "a", 540)
	result = publish(lecture)
	if len(result.Events) != 0 || len(result.Issues) != 1 || result.Issues[0].Message != "301: в этот день по учебному графику проходит практика" {
		t.Fatalf("group period did not block lecture publication: %v", result)
	}
	lecture = save("2026-11-27", "a", 540)
	if result := publish(lecture); len(result.Events) != 1 || len(result.Issues) != 0 {
		t.Fatalf("overlapping period was not rolled back: %v", result)
	}

	clinical, err := schedule.Save(ctx, &rpc.EventSaveRequest{Details: &pb.EventInput{
		TermId: "term", SubjectId: "subject", Type: scheduleenum.EventType_EVENT_TYPE_CLINICAL_CYCLE,
		Audiences: []*pb.Audience{{Group: "401", Subgroup: "A", Course: 4}}, ExpectedAttendance: 10,
		Date: "2026-11-28", StartMinute: new(int32(540)), DurationMinutes: 90, RoomId: "b",
	}}, actor)
	if err != nil || len(clinical) != 1 {
		t.Fatalf("save incomplete clinical day: %v %v", clinical, err)
	}
	gaps, err := schedule.Completeness(ctx, "term")
	if err != nil {
		t.Fatal(err)
	}
	for _, kind := range []scheduleenum.CompletenessGapType{
		scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_INSTRUCTOR,
		scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_CLINICAL_DETAILS,
	} {
		if !slices.ContainsFunc(gaps, func(gap *pb.CompletenessGap) bool {
			return gap.Type == kind && gap.Event.GetId() == clinical[0].Id
		}) {
			t.Fatalf("missing %s for incomplete clinical day: %v", kind, gaps)
		}
	}
	if !slices.ContainsFunc(gaps, func(gap *pb.CompletenessGap) bool {
		return gap.Type == scheduleenum.CompletenessGapType_COMPLETENESS_GAP_TYPE_GROUP && gap.Audience.GetGroup() == "401"
	}) {
		t.Fatalf("incomplete clinical day must not count as group coverage: %v", gaps)
	}
}
