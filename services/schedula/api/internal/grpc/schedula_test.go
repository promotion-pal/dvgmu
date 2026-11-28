package grpc_test

import (
	"context"
	"crypto/rand"
	"errors"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"connectrpc.com/connect"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"dvgmu/schedula"
	"dvgmu/schedula/internal/grpc"
	"dvgmu/schedula/internal/service"
	"dvgmu/schedula/internal/storage"
	mdmentity "fesmu/contract/mdm/entity"
	mdmenum "fesmu/contract/mdm/enum"
	mdm "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
	rpc "fesmu/contract/schedula/service"
	"fesmu/contract/schedula/service/serviceconnect"
)

func TestScheduleLifecycle(t *testing.T) {
	open := testDatabase(t)
	db := open(t)
	ctx := t.Context()
	token := rand.Text()

	mdmMux := http.NewServeMux()
	var testingRevoked atomic.Bool
	mdm := testDirectory{testingRevoked: &testingRevoked}
	mdmMux.Handle(mdmconnect.NewUserServiceHandler(mdm))
	mdmMux.Handle(mdmconnect.NewUserDirectoryServiceHandler(mdm))
	directory := httptest.NewServer(mdmMux)
	t.Cleanup(directory.Close)
	mdmClient := mdmconnect.NewUserServiceClient(directory.Client(), directory.URL)
	directoryClient := mdmconnect.NewUserDirectoryServiceClient(directory.Client(), directory.URL)
	start := func(db *gorm.DB) (serviceconnect.SchedulaServiceClient, func()) {
		log := slog.New(slog.NewTextHandler(io.Discard, nil))
		svc := service.New(storage.New(db), time.UTC, func(context.Context) ([]service.Group, error) {
			return []service.Group{{Code: "301", Course: 3, Count: 20}, {Code: "402", Course: 4, Count: 12}}, nil
		})
		_, handler := serviceconnect.NewSchedulaServiceHandler(grpc.New(svc, mdmClient, directoryClient, log),
			connect.WithInterceptors(grpc.Authenticate(token, mdmClient, directoryClient)))
		server := httptest.NewServer(handler)
		t.Cleanup(server.Close)
		return serviceconnect.NewSchedulaServiceClient(server.Client(), server.URL), server.Close
	}
	client, stop := start(db)

	admin := func() map[string]string {
		return map[string]string{"Authorization": "Bearer " + token, "X-Schedula-User": "admin"}
	}
	as := func(user string) map[string]string {
		return map[string]string{"Authorization": "Bearer " + token, "X-Schedula-User": user}
	}
	request := &rpc.EventSaveRequest{Details: &pb.EventInput{
		TermId: "term", SubjectId: "subject", Type: scheduleenum.EventType_EVENT_TYPE_LECTURE,
		Audiences: []*pb.Audience{{Group: "301", Course: 3}}, InstructorId: "teacher",
		Date: "2026-11-24", StartMinute: new(int32(540)), DurationMinutes: 90, RoomId: "a214",
		ExpectedAttendance: 20, Equipment: []string{"Проектор"},
	}}
	_, err := client.EventSave(ctx, connect.NewRequest(request))
	if connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("unauthenticated save: %v", err)
	}
	_, err = client.EventSave(ctx, signed(request, map[string]string{"Authorization": "Bearer " + token, "X-Schedula-User": "student"}))
	if connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("student save: %v", err)
	}

	_, err = client.CatalogSave(ctx, signed(&rpc.CatalogSaveRequest{Catalog: &pb.Catalog{
		Terms:    []*pb.Term{{Id: "term", Name: "Осенний семестр", DateFrom: "2026-09-01", DateTo: "2027-01-31"}},
		Subjects: []*pb.Subject{{Id: "subject", Name: "Внутренние болезни"}},
		Sites:    []*pb.Site{{Id: "main", Name: "Главный корпус", Address: "Адрес"}},
		Rooms:    []*pb.Room{{Id: "a214", Site: &pb.Site{Id: "main"}, Name: "Аудитория 214", Capacity: 30, Equipment: []string{"Проектор"}, OpensAt: 480, ClosesAt: 1140}},
	}}, admin()))
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		dateTo string
		week   int32
	}{{"2026-08-31", 0}, {"2026-09-02", 1}} {
		filter := &pb.ScheduleFilter{DateFrom: "2026-08-01", DateTo: tc.dateTo}
		internal, err := client.ScheduleFetch(ctx, signed(&rpc.ScheduleFetchRequest{Filter: filter}, admin()))
		if err != nil || internal.Msg.AcademicWeek != tc.week {
			t.Fatalf("academic week through %s: %v %v", tc.dateTo, internal, err)
		}
		external, err := client.PublicScheduleFetch(ctx, signed(&rpc.PublicScheduleFetchRequest{Filter: filter},
			map[string]string{"Authorization": "Bearer " + token}))
		if err != nil || external.Msg.AcademicWeek != tc.week {
			t.Fatalf("public academic week through %s: %v %v", tc.dateTo, external, err)
		}
	}

	created, err := client.EventSave(ctx, signed(request, as("scheduler")))
	if err != nil {
		t.Fatal(err)
	}
	first := created.Msg.Events[0]
	filter := &pb.ScheduleFilter{DateFrom: "2026-11-24"}
	mayPublish := &rpc.EventPublishRequest{Id: first.Id, Revision: first.Revision}
	for _, user := range []string{"student", "teacher", "tester", "scheduler", "legacy-editor"} {
		if _, err := client.EventPublish(ctx, signed(mayPublish, as(user))); connect.CodeOf(err) != connect.CodePermissionDenied {
			t.Fatalf("%s could publish a draft: %v", user, err)
		}
	}
	if _, err := client.EventSave(ctx, signed(request, as("tester"))); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("tester could create a draft: %v", err)
	}
	if _, err := client.EventSave(ctx, signed(request, as("publisher"))); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("publisher could create a draft: %v", err)
	}
	if _, err := client.CompletenessFetch(ctx, signed(&rpc.CompletenessFetchRequest{TermId: "term"}, as("scheduler"))); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("draft editor could view completeness: %v", err)
	}
	for _, tc := range []struct {
		user                 string
		drafts               int
		edit, publish, slots bool
	}{{"tester", 0, false, false, true}, {"scheduler", 1, true, false, true}, {"publisher", 1, false, true, false}, {"legacy-editor", 0, false, false, false}} {
		result, err := client.ScheduleFetch(ctx, signed(&rpc.ScheduleFetchRequest{Filter: filter, IncludeDrafts: true}, as(tc.user)))
		if err != nil || len(result.Msg.Events) != tc.drafts || result.Msg.CanEdit != tc.edit ||
			result.Msg.CanPublish != tc.publish || result.Msg.CanSearchSlots != tc.slots {
			t.Fatalf("schedule rights for %s: %v %v", tc.user, result, err)
		}
	}
	public := func(client serviceconnect.SchedulaServiceClient) []*pb.PublicEvent {
		t.Helper()
		result, err := client.PublicScheduleFetch(ctx, signed(&rpc.PublicScheduleFetchRequest{Filter: filter}, map[string]string{"Authorization": "Bearer " + token}))
		if err != nil {
			t.Fatal(err)
		}
		return result.Msg.Events
	}
	if found := public(client); len(found) != 0 {
		t.Fatalf("public schedule exposed draft: %v", found)
	}
	request.Id, request.Revision = first.Id, first.Revision
	request.Details.StartMinute = new(int32(555))
	edited, err := client.EventSave(ctx, signed(request, admin()))
	if err != nil || edited.Msg.Events[0].Details.GetStartMinute() != 555 {
		t.Fatalf("save edited time: %v %v", edited, err)
	}
	_, err = client.EventPublish(ctx, signed(&rpc.EventPublishRequest{Id: first.Id, Revision: first.Revision}, admin()))
	if connect.CodeOf(err) != connect.CodeFailedPrecondition {
		t.Fatalf("stale publish: %v", err)
	}
	request.Id, request.Revision = "", 0
	request.Details.StartMinute = new(int32(600))
	overlap, err := client.EventSave(ctx, signed(request, admin()))
	if err != nil {
		t.Fatal(err)
	}
	first = edited.Msg.Events[0]
	blocked, err := client.EventPublish(ctx, signed(&rpc.EventPublishRequest{Id: first.Id, Revision: first.Revision}, admin()))
	if err != nil || len(blocked.Msg.Issues) != 3 {
		t.Fatalf("conflicting publication: %v %v", blocked, err)
	}
	request.Id, request.Revision = overlap.Msg.Events[0].Id, overlap.Msg.Events[0].Revision
	request.Details.StartMinute = new(int32(645))
	if _, err := client.EventSave(ctx, signed(request, admin())); err != nil {
		t.Fatal(err)
	}
	published, err := client.EventPublish(ctx, signed(&rpc.EventPublishRequest{Id: first.Id, Revision: first.Revision}, as("publisher")))
	if err != nil || len(published.Msg.Events) != 1 || len(published.Msg.Issues) != 0 {
		t.Fatalf("publish free event: %v %v", published, err)
	}
	first = published.Msg.Events[0]
	for _, user := range []string{"student", "teacher"} {
		mine, err := client.ScheduleFetch(ctx, signed(&rpc.ScheduleFetchRequest{Filter: filter, Personal: true, IncludeDrafts: true},
			map[string]string{"Authorization": "Bearer " + token, "X-Schedula-User": user}))
		if err != nil || mine.Msg.CanEdit || len(mine.Msg.Events) != 1 || mine.Msg.Events[0].Id != first.Id ||
			mine.Msg.Events[0].InstructorName != "Иванов Михаил" {
			t.Fatalf("personal schedule for %s: %v %v", user, mine, err)
		}
	}

	free, err := client.SlotsFetch(ctx, signed(&rpc.SlotsFetchRequest{
		Details: request.Details, DateFrom: filter.DateFrom, DateTo: filter.DateFrom,
	}, admin()))
	if err != nil || len(free.Msg.Slots) == 0 {
		t.Fatalf("find available slots: %v %v", free, err)
	}
	for _, slot := range free.Msg.Slots {
		if slot.StartMinute < 735 && slot.StartMinute+slot.DurationMinutes > 555 {
			t.Fatalf("slot overlaps existing use: %v", slot)
		}
	}
	testingSlots := &rpc.SlotsFetchRequest{
		Details: &pb.EventInput{
			TermId: "term", SubjectId: "subject", Type: scheduleenum.EventType_EVENT_TYPE_EXAM,
			Audiences: []*pb.Audience{{Group: "301", Course: 3}}, InstructorId: "teacher",
			DurationMinutes: 90, ExpectedAttendance: 20,
		},
		DateFrom: filter.DateFrom, DateTo: filter.DateFrom,
	}
	slots, err := client.SlotsFetch(ctx, signed(testingSlots, as("tester")))
	if err != nil || len(slots.Msg.Slots) == 0 {
		t.Fatalf("tester slot search: %v %v", slots, err)
	}
	for _, slot := range slots.Msg.Slots {
		if slot.StartMinute < 645 && slot.StartMinute+slot.DurationMinutes > 555 {
			t.Fatalf("tester slot overlaps the published event: %v", slot)
		}
	}
	testingSlots.ExcludeEventId = first.Id
	if _, err := client.SlotsFetch(ctx, signed(testingSlots, as("tester"))); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("tester could exclude an existing event: %v", err)
	}
	testingSlots.ExcludeEventId = ""
	if _, err := client.SlotsFetch(ctx, signed(testingSlots, as("classroom-editor"))); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("computer classroom permissions opened slot search: %v", err)
	}
	testingRevoked.Store(true)
	if _, err := client.SlotsFetch(ctx, signed(testingSlots, as("tester"))); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("tester retained access after revocation: %v", err)
	}
	testingRevoked.Store(false)
	report, err := client.CompletenessFetch(ctx, signed(&rpc.CompletenessFetchRequest{TermId: "term"}, admin()))
	if err != nil || len(report.Msg.Gaps) != 2 || report.Msg.Gaps[0].Audience.GetCourse() != 4 ||
		report.Msg.Gaps[1].Audience.GetGroup() != "402" {
		t.Fatalf("completeness report: %v %v", report, err)
	}

	_, err = client.ChangeCreate(ctx, signed(&rpc.ChangeCreateRequest{
		EventId: first.Id, Revision: first.Revision, Type: scheduleenum.ChangeType_CHANGE_TYPE_MOVE, Reason: "Причина",
		Date: first.Details.Date, StartMinute: first.Details.StartMinute,
	}, admin()))
	if connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("submitted a move without changes: %v", err)
	}

	reason := "Внутренняя причина"
	change, err := client.ChangeCreate(ctx, signed(&rpc.ChangeCreateRequest{
		EventId: first.Id, Revision: first.Revision, Type: scheduleenum.ChangeType_CHANGE_TYPE_MOVE, Reason: reason,
		Date: "2026-11-24", StartMinute: new(int32(720)),
	}, map[string]string{"Authorization": "Bearer " + token, "X-Schedula-User": "teacher"}))
	if err != nil || change.Msg.Change.GetId() == "" || len(change.Msg.Issues) != 0 {
		t.Fatalf("submit change: %v %v", change, err)
	}
	if items := public(client); len(items) != 1 || items[0].StartMinute != 555 {
		t.Fatalf("pending request changed public schedule: %v", items)
	}
	decision := &rpc.ChangeDecideRequest{Id: change.Msg.Change.Id, Approve: true}
	if _, err := client.ChangeDecide(ctx, signed(decision, as("publisher"))); connect.CodeOf(err) != connect.CodePermissionDenied {
		t.Fatalf("publisher could approve a change: %v", err)
	}
	if result, err := client.ChangeDecide(ctx, signed(decision, as("reviewer"))); err != nil || result.Msg.Change.GetStatus() != scheduleenum.ChangeStatus_CHANGE_STATUS_APPROVED {
		t.Fatalf("approve change: %v %v", result, err)
	}
	history, err := client.ChangeHistoryFetch(ctx, signed(&rpc.ChangeHistoryFetchRequest{EventId: first.Id}, admin()))
	if err != nil || len(history.Msg.Changes) != 1 {
		t.Fatalf("read change history: %v %v", history, err)
	}
	entry := history.Msg.Changes[0]
	if entry.AuthorId != "teacher" || entry.ReviewerId != "reviewer" || entry.SubmittedAt == "" || entry.DecidedAt == "" {
		t.Fatalf("incomplete change history: %v", entry)
	}

	stop()
	client, _ = start(open(t))
	if items := public(client); len(items) != 1 || items[0].Id != first.Id || items[0].StartMinute != 720 ||
		items[0].Status != scheduleenum.EventStatus_EVENT_STATUS_PUBLISHED || strings.Contains(items[0].String(), reason) {
		t.Fatalf("public schedule after restart: %v", items)
	}

	_, err = client.CatalogSave(ctx, signed(&rpc.CatalogSaveRequest{Catalog: &pb.Catalog{
		Holidays: []*pb.Holiday{{Date: filter.DateFrom, Name: "Праздник"}},
	}}, admin()))
	if err != nil {
		t.Fatal(err)
	}
	if items := public(client); len(items) != 0 {
		t.Fatalf("public schedule exposed a holiday event: %v", items)
	}
	nextDay, err := client.ScheduleFetch(ctx, signed(&rpc.ScheduleFetchRequest{
		Filter: &pb.ScheduleFilter{DateFrom: "2026-11-25"},
	}, admin()))
	if err != nil || len(nextDay.Msg.Events) > 0 || len(nextDay.Msg.Transfers) != 1 ||
		nextDay.Msg.Transfers[0].Status != scheduleenum.EventStatus_EVENT_STATUS_TRANSFER {
		t.Fatalf("unresolved holiday transfer missing in the next period: %v %v", nextDay, err)
	}

	request.Id, request.Revision = "", 0
	request.Details.Date = "2026-12-01"
	request.Details.StartMinute = new(int32(540))
	request.Series = &pb.Series{Recurrence: scheduleenum.Recurrence_RECURRENCE_WEEKLY, DateTo: "2026-12-08",
		Slots: []*pb.WeeklySlot{{Weekday: 2, StartMinute: 540, DurationMinutes: 90}},
	}
	series, err := client.EventSave(ctx, signed(request, admin()))
	if err != nil || len(series.Msg.Events) != 2 {
		t.Fatalf("save series: %v %v", series, err)
	}
	booking := &pb.Booking{Id: "booking", RoomId: "a214", Date: "2026-12-08", StartMinute: 555, DurationMinutes: 60, Title: "Бронь"}
	setBooking := func() {
		t.Helper()
		_, err := client.CatalogSave(ctx, signed(&rpc.CatalogSaveRequest{Catalog: &pb.Catalog{Bookings: []*pb.Booking{booking}}}, admin()))
		if err != nil {
			t.Fatal(err)
		}
	}
	setBooking()
	batch := &rpc.EventPublishRequest{Id: series.Msg.Events[0].Id, Revision: 1, Series: true}
	seriesBlocked, err := client.EventPublish(ctx, signed(batch, admin()))
	if err != nil || len(seriesBlocked.Msg.Events) != 0 || len(seriesBlocked.Msg.Issues) != 1 ||
		seriesBlocked.Msg.Issues[0].ConflictingEvent.GetId() != booking.Id {
		t.Fatalf("booking on the second date should block the entire series: %v %v", seriesBlocked, err)
	}
	booking.Cancelled = true
	setBooking()
	seriesPublished, err := client.EventPublish(ctx, signed(batch, admin()))
	if err != nil || len(seriesPublished.Msg.Events) != 2 || len(seriesPublished.Msg.Issues) != 0 ||
		seriesPublished.Msg.Events[0].Revision != 2 || seriesPublished.Msg.Events[1].Revision != 2 {
		t.Fatalf("publish both dates after cancelling the booking: %v %v", seriesPublished, err)
	}

	request.Id, request.Revision, request.Series = "", 0, nil
	request.Details.Date = "2026-12-03"
	request.Details.Audiences = []*pb.Audience{{Group: "301", Subgroup: "2", Course: 3}}
	subgroupDraft, err := client.EventSave(ctx, signed(request, admin()))
	if err != nil || len(subgroupDraft.Msg.Events) != 1 {
		t.Fatalf("create subgroup draft: %v %v", subgroupDraft, err)
	}
	subgroupEvent := subgroupDraft.Msg.Events[0]
	subgroupPublished, err := client.EventPublish(ctx, signed(&rpc.EventPublishRequest{Id: subgroupEvent.Id, Revision: subgroupEvent.Revision}, admin()))
	if err != nil || len(subgroupPublished.Msg.Events) != 1 {
		t.Fatalf("publish subgroup event: %v %v", subgroupPublished, err)
	}
	subgroupFilter := &pb.ScheduleFilter{DateFrom: "2026-12-03", Group: "301", Subgroup: "2"}
	studentView, err := client.ScheduleFetch(ctx, signed(&rpc.ScheduleFetchRequest{Filter: subgroupFilter}, as("student")))
	if err != nil || len(studentView.Msg.Events) != 0 {
		t.Fatalf("student could access an unassigned subgroup through the group filter: %v %v", studentView, err)
	}
	testerView, err := client.ScheduleFetch(ctx, signed(&rpc.ScheduleFetchRequest{Filter: subgroupFilter}, as("tester")))
	if err != nil || len(testerView.Msg.Events) != 1 {
		t.Fatalf("tester could not see subgroup occupancy: %v %v", testerView, err)
	}

	request.Details.Date = "2026-12-04"
	request.Details.Audiences = []*pb.Audience{{Group: "402", Course: 4}}
	secondGroup, err := client.EventSave(ctx, signed(request, admin()))
	if err != nil || len(secondGroup.Msg.Events) != 1 {
		t.Fatalf("create event for the second enrollment: %v %v", secondGroup, err)
	}
	second := secondGroup.Msg.Events[0]
	secondPublished, err := client.EventPublish(ctx, signed(&rpc.EventPublishRequest{Id: second.Id, Revision: second.Revision}, admin()))
	if err != nil || len(secondPublished.Msg.Events) != 1 {
		t.Fatalf("publish event for the second enrollment: %v %v", secondPublished, err)
	}
	personal, err := client.ScheduleFetch(ctx, signed(&rpc.ScheduleFetchRequest{
		Filter: &pb.ScheduleFilter{DateFrom: "2026-12-01", DateTo: "2026-12-04"}, Personal: true,
	}, as("student")))
	if err != nil || len(personal.Msg.Events) != 2 ||
		personal.Msg.Events[0].Id != seriesPublished.Msg.Events[0].Id || personal.Msg.Events[1].Id != second.Id {
		t.Fatalf("personal schedule should include both active groups and exclude the unassigned subgroup: %v %v", personal, err)
	}

	t.Run("travel norms through Connect", func(t *testing.T) {
		otherSite := &pb.Site{Id: "second-building", Name: "Второй корпус", Address: "Другой адрес"}
		_, err := client.CatalogSave(ctx, signed(&rpc.CatalogSaveRequest{Catalog: &pb.Catalog{
			Sites: []*pb.Site{otherSite},
			Rooms: []*pb.Room{{Id: "b10", Site: otherSite, Name: "Аудитория 10", Capacity: 30, OpensAt: 480, ClosesAt: 1140}},
		}}, admin()))
		if err != nil {
			t.Fatal(err)
		}
		for _, tc := range []struct {
			day       string
			norm      *int32
			issue     scheduleenum.IssueType
			published bool
		}{
			{"2026-12-10", nil, scheduleenum.IssueType_ISSUE_TYPE_TRAVEL_NORM_MISSING, true},
			{"2026-12-11", new(int32(0)), scheduleenum.IssueType_ISSUE_TYPE_UNSPECIFIED, true},
			{"2026-12-12", new(int32(20)), scheduleenum.IssueType_ISSUE_TYPE_TRAVEL, false},
		} {
			if tc.norm != nil {
				_, err := client.CatalogSave(ctx, signed(&rpc.CatalogSaveRequest{Catalog: &pb.Catalog{
					TravelTimes: []*pb.TravelTime{{FromSiteId: "main", ToSiteId: otherSite.Id, Minutes: *tc.norm}},
				}}, admin()))
				if err != nil {
					t.Fatal(err)
				}
			}
			draft := func(room string, start int32) *pb.Event {
				t.Helper()
				response, err := client.EventSave(ctx, signed(&rpc.EventSaveRequest{Details: &pb.EventInput{
					TermId: "term", SubjectId: "subject", Type: scheduleenum.EventType_EVENT_TYPE_LECTURE,
					Audiences: []*pb.Audience{{Group: "301", Course: 3}}, InstructorId: "teacher",
					Date: tc.day, StartMinute: &start, DurationMinutes: 60, RoomId: room,
				}}, admin()))
				if err != nil || len(response.Msg.Events) != 1 {
					t.Fatalf("create draft on %s: %v %v", tc.day, response, err)
				}
				return response.Msg.Events[0]
			}
			first := draft("a214", 540)
			publish := func(event *pb.Event) *rpc.EventPublishResponse {
				t.Helper()
				response, err := client.EventPublish(ctx, signed(&rpc.EventPublishRequest{Id: event.Id, Revision: event.Revision}, admin()))
				if err != nil {
					t.Fatal(err)
				}
				return response.Msg
			}
			if result := publish(first); len(result.Events) != 1 || len(result.Issues) != 0 {
				t.Fatalf("publish first event on %s: %v", tc.day, result)
			}
			second := draft("b10", 610)
			assertIssue := func(issues []*pb.Issue) {
				t.Helper()
				if tc.issue == scheduleenum.IssueType_ISSUE_TYPE_UNSPECIFIED {
					if len(issues) != 0 {
						t.Fatalf("unexpected issue for zero minutes: %v", issues)
					}
				} else if len(issues) != 1 || issues[0].Type != tc.issue || issues[0].ConflictingEvent.GetId() != first.Id {
					t.Fatalf("wrong issue on %s: %v", tc.day, issues)
				}
			}
			checked, err := client.EventCheckFetch(ctx, signed(&rpc.EventCheckFetchRequest{Id: second.Id}, admin()))
			if err != nil {
				t.Fatal(err)
			}
			assertIssue(checked.Msg.Issues)
			result := publish(second)
			assertIssue(result.Issues)
			if (len(result.Events) == 1) != tc.published {
				t.Fatalf("unexpected publication result on %s: %v", tc.day, result)
			}
		}
	})
}

func signed[T any](msg *T, headers map[string]string) *connect.Request[T] {
	req := connect.NewRequest(msg)
	for key, value := range headers {
		req.Header().Set(key, value)
	}
	return req
}

type testDirectory struct {
	mdmconnect.UnimplementedUserServiceHandler
	mdmconnect.UnimplementedUserDirectoryServiceHandler
	testingRevoked *atomic.Bool
}

func (d testDirectory) UserFetchByUUID(_ context.Context, req *connect.Request[mdm.UserFetchByUUIDRequest]) (*connect.Response[mdm.UserFetchByUUIDResponse], error) {
	roles := map[string]mdmenum.UserRole{
		"admin": mdmenum.UserRole_USER_ROLE_ADMIN, "student": mdmenum.UserRole_USER_ROLE_STUDENT, "teacher": mdmenum.UserRole_USER_ROLE_TEACHER,
	}
	permissions := map[string][]string{
		"tester":           {"schedule_testing.fetch"},
		"scheduler":        {"schedule_drafts.post"},
		"publisher":        {"schedule_publication.post"},
		"reviewer":         {"schedule_changes.post"},
		"legacy-editor":    {"schedule.post"},
		"classroom-editor": {"computer_classes.post"},
	}
	role := roles[req.Msg.Uuid]
	if len(permissions[req.Msg.Uuid]) != 0 {
		role = mdmenum.UserRole_USER_ROLE_STAFF
	}
	if req.Msg.Uuid == "tester" && d.testingRevoked.Load() {
		delete(permissions, "tester")
	}
	return connect.NewResponse(&mdm.UserFetchByUUIDResponse{User: &mdmentity.User{
		Id: 1, Uuid: req.Msg.Uuid, Status: mdmenum.UserStatus_USER_STATUS_ACTIVE, Roles: []mdmenum.UserRole{role},
	}, EffectivePermissions: permissions[req.Msg.Uuid]}), nil
}

func (testDirectory) UserDirectoryFetch(_ context.Context, req *connect.Request[mdm.UserDirectoryFetchRequest]) (*connect.Response[mdm.UserDirectoryFetchResponse], error) {
	if req.Msg.ProfileKind == "student" {
		if !req.Msg.ActiveStudentsOnly || len(req.Msg.UserUuids) != 1 || req.Msg.UserUuids[0] != "student" || req.Msg.Limit != 1 {
			return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("expected an active enrollment lookup scoped to the student"))
		}
		return connect.NewResponse(&mdm.UserDirectoryFetchResponse{ProfileKind: "student", Users: []*mdm.UserDirectoryEntry{{
			Uuid: "student", Students: []*mdm.UserDirectoryStudent{
				{Group: " 301 ", Status: mdmenum.UserStudentStatus_USER_STUDENT_STATUS_UNSPECIFIED},
				{Group: "402", Status: mdmenum.UserStudentStatus_USER_STUDENT_STATUS_TRANSFERRED},
			},
		}}}), nil
	}
	if ids := req.Msg.UserUuids; len(ids) != 1 || ids[0] != "teacher" || req.Msg.ProfileKind != "employee" ||
		req.Msg.Role != mdmenum.UserRole_USER_ROLE_TEACHER || req.Msg.UserStatus != mdmenum.UserStatus_USER_STATUS_ACTIVE {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("expected a scoped instructor lookup"))
	}
	return connect.NewResponse(&mdm.UserDirectoryFetchResponse{Users: []*mdm.UserDirectoryEntry{{Uuid: "teacher", FullName: "Иванов Михаил"}}}), nil
}

func testDatabase(t *testing.T) func(*testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("SCHEDULA_TEST_DSN")
	if dsn == "" {
		t.Skip("SCHEDULA_TEST_DSN is not set")
	}
	open := func(t *testing.T, dsn string) *gorm.DB {
		t.Helper()
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard, TranslateError: true})
		if err != nil {
			t.Fatal(err)
		}
		pool, err := db.DB()
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = pool.Close() })
		return db
	}
	base := open(t, dsn)
	schema := "schedula_test_" + strings.ToLower(rand.Text())
	if err := base.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := base.Exec("DROP SCHEMA " + schema + " CASCADE").Error; err != nil {
			t.Error(err)
		}
	})
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	db := open(t, u.String())
	pool, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	files, err := fs.Sub(schedula.MigrationsFS, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	migrations, err := goose.NewProvider(goose.DialectPostgres, pool, files)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := migrations.Up(t.Context()); err != nil {
		t.Fatal(err)
	}
	return func(t *testing.T) *gorm.DB { return open(t, u.String()) }
}
