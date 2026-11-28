package service

import (
	"cmp"
	"context"
	"crypto/rand"
	"errors"
	"maps"
	"slices"
	"strings"
	"time"

	"connectrpc.com/connect"
	"gorm.io/gorm"

	"dvgmu/schedula/internal/domain/models"
	"dvgmu/schedula/internal/storage"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
	rpc "fesmu/contract/schedula/service"
)

const (
	draft     = scheduleenum.EventStatus_EVENT_STATUS_DRAFT
	published = scheduleenum.EventStatus_EVENT_STATUS_PUBLISHED
	cancelled = scheduleenum.EventStatus_EVENT_STATUS_CANCELLED
)

type Actor struct {
	ID               string
	Groups           []string
	Subgroup         string
	Student          bool
	Teacher          bool
	CanEdit          bool
	CanFindSlots     bool
	CanPublish       bool
	CanReviewChanges bool
	CanEditCatalog   bool
	CanViewReports   bool
}

func (a Actor) CanSeeDrafts() bool { return a.CanEdit || a.CanPublish || a.CanViewReports }

type Service struct {
	store    *storage.Storage
	location *time.Location
	groups   GroupsFetch
}

func New(store *storage.Storage, location *time.Location, groups GroupsFetch) *Service {
	return &Service{store: store, location: location, groups: groups}
}

func (s *Service) Schedule(ctx context.Context, input *rpc.ScheduleFetchRequest, actor Actor) (*rpc.ScheduleFetchResponse, error) {
	f := input.GetFilter()
	from, to, err := scheduleRange(f, time.Now().In(s.location))
	if err != nil {
		return nil, err
	}
	week, err := s.weekInRange(ctx, from, to)
	if err != nil {
		return nil, err
	}
	withDrafts := input.IncludeDrafts && actor.CanSeeDrafts() && !input.Personal
	events, err := s.store.Events(ctx, from, to, withDrafts)
	if err != nil {
		return nil, err
	}
	result := &rpc.ScheduleFetchResponse{
		DateFrom: from.Format(time.DateOnly), DateTo: to.Format(time.DateOnly), AcademicWeek: week,
		CanEdit: actor.CanEdit, CanSearchSlots: actor.CanFindSlots, CanRequestChange: actor.Teacher || actor.CanReviewChanges,
		CanPublish: actor.CanPublish, CanReviewChanges: actor.CanReviewChanges,
		CanViewReports: actor.CanViewReports, CanEditCatalog: actor.CanEditCatalog,
	}
	personal := input.Personal && f.GetGroup() == "" && f.GetCourse() == 0
	studentView := actor.Student && !actor.Teacher && !actor.CanSeeDrafts() &&
		!actor.CanFindSlots && !actor.CanReviewChanges && !actor.CanEditCatalog
	studentAudience := func(a models.Audience) bool { return a.Subgroup == "" || matchesStudent(a, actor) }
	visibleEvent := func(e models.Event) (models.Event, bool) {
		if studentView {
			e.Audiences = slices.DeleteFunc(slices.Clone(e.Audiences), func(a models.Audience) bool { return !studentAudience(a) })
		}
		return e, matchesEvent(e, f) && (!personal || matchesActor(e, actor))
	}
	for _, e := range events {
		if e, visible := visibleEvent(e); visible {
			result.Events = append(result.Events, eventSnapshot(e, e.Status))
		}
	}
	transfers, err := s.store.Transfers(ctx, from, to, withDrafts)
	if err != nil {
		return nil, err
	}
	for _, e := range transfers {
		if e, visible := visibleEvent(e); visible {
			status := e.Status
			if status == published {
				status = scheduleenum.EventStatus_EVENT_STATUS_TRANSFER
			}
			result.Transfers = append(result.Transfers, eventSnapshot(e, status))
		}
	}
	periods, err := s.store.Periods(ctx, from, to)
	if err != nil {
		return nil, err
	}
	for _, p := range periods {
		a := models.Audience{Group: p.Group, Subgroup: p.Subgroup, Course: p.Course}
		if (personal && !matchesStudent(a, actor)) || (studentView && !studentAudience(a)) || !matchesAudience(a, f) {
			continue
		}
		result.Periods = append(result.Periods, periodProto(p))
	}
	return result, nil
}

func (s *Service) PublicSchedule(ctx context.Context, f *pb.ScheduleFilter) (*rpc.PublicScheduleFetchResponse, error) {
	if f.GetInstructorId() != "" || f.GetSubgroup() != "" {
		return nil, invalid("фильтр доступен в личном кабинете")
	}
	from, to, err := scheduleRange(f, time.Now().In(s.location))
	if err != nil {
		return nil, err
	}
	week, err := s.weekInRange(ctx, from, to)
	if err != nil {
		return nil, err
	}
	events, err := s.store.Events(ctx, from, to, false)
	if err != nil {
		return nil, err
	}
	result := &rpc.PublicScheduleFetchResponse{
		DateFrom: from.Format(time.DateOnly), DateTo: to.Format(time.DateOnly), AcademicWeek: week,
	}
	subjects := make(map[string]*pb.Subject)
	sites, rooms := make(map[string]*pb.PublicOption), make(map[string]*pb.PublicOption)
	for _, e := range events {
		if subjects[e.SubjectID] == nil {
			subjects[e.SubjectID] = subjectProto(e.Subject)
		}
		if sites[e.Room.SiteID] == nil {
			sites[e.Room.SiteID] = &pb.PublicOption{Id: e.Room.SiteID, Name: e.Room.Site.Name}
		}
		if rooms[e.Room.ID] == nil {
			rooms[e.Room.ID] = &pb.PublicOption{Id: e.Room.ID, Name: e.Room.Name, SiteId: e.Room.SiteID}
		}
		if matchesEvent(e, f) {
			result.Events = append(result.Events, publicEventProto(e))
		}
	}
	result.Subjects = sortedOptions(subjects)
	result.Sites = sortedOptions(sites)
	result.Rooms = sortedOptions(rooms)
	return result, nil
}

func sortedOptions[T interface {
	GetId() string
	GetName() string
}](options map[string]T) []T {
	return slices.SortedFunc(maps.Values(options), func(a, b T) int {
		return cmp.Or(strings.Compare(a.GetName(), b.GetName()), strings.Compare(a.GetId(), b.GetId()))
	})
}

func matchesEvent(e models.Event, f *pb.ScheduleFilter) bool {
	return (f.GetInstructorId() == "" || f.GetInstructorId() == e.InstructorID) &&
		(f.GetSubjectId() == "" || f.GetSubjectId() == e.SubjectID) &&
		(f.GetSiteId() == "" || f.GetSiteId() == e.Room.SiteID) &&
		(f.GetRoomId() == "" || f.GetRoomId() == e.Room.ID) &&
		(f.GetType() == 0 || f.GetType() == e.Type) &&
		(len(f.GetTypes()) == 0 || slices.Contains(f.GetTypes(), e.Type)) &&
		slices.ContainsFunc(e.Audiences, func(a models.Audience) bool { return matchesAudience(a, f) })
}

func matchesAudience(a models.Audience, f *pb.ScheduleFilter) bool {
	return (f.GetGroup() == "" || f.GetGroup() == a.Group) &&
		(f.GetSubgroup() == "" || f.GetSubgroup() == a.Subgroup) &&
		(f.GetCourse() == 0 || f.GetCourse() == a.Course)
}

func matchesStudent(a models.Audience, actor Actor) bool {
	return actor.Student && slices.Contains(actor.Groups, a.Group) && (a.Subgroup == "" || a.Subgroup == actor.Subgroup)
}

func matchesActor(e models.Event, actor Actor) bool {
	return actor.Teacher && e.InstructorID == actor.ID ||
		slices.ContainsFunc(e.Audiences, func(a models.Audience) bool { return matchesStudent(a, actor) })
}

func (s *Service) Save(ctx context.Context, in *rpc.EventSaveRequest, actor Actor) (result []*pb.Event, err error) {
	err = s.store.Write(ctx, func(tx *storage.Storage) error {
		c, err := loadCatalog(ctx, tx, false)
		if err != nil {
			return err
		}
		e, err := c.event(in.Details)
		if err != nil {
			return err
		}
		e.Status = draft
		e.UpdatedAt = time.Now()
		if in.Id == "" {
			e.ID, e.AuthorID, e.CreatedAt, e.Revision = newID(), actor.ID, e.UpdatedAt, 1
			events, err := expand(e, in.Series, c.terms[e.TermID])
			if err != nil {
				return err
			}
			if err := tx.InsertEvents(ctx, events); err != nil {
				return err
			}
			for _, item := range events {
				result = append(result, eventProto(item, c))
			}
			return nil
		}
		if in.Series != nil {
			return invalid("серия задаётся при создании черновиков")
		}
		current, err := eventByID(ctx, tx, in.Id)
		if err != nil {
			return err
		}
		if err := requireRevision(current, in.Revision, draft); err != nil {
			return err
		}
		e.ID, e.AuthorID, e.CreatedAt, e.SeriesID = current.ID, current.AuthorID, current.CreatedAt, current.SeriesID
		e.Revision = current.Revision + 1
		if err := tx.UpdateEvent(ctx, &e); err != nil {
			return err
		}
		result = []*pb.Event{eventProto(e, c)}
		return nil
	})
	return result, err
}

func (s *Service) Check(ctx context.Context, id string) ([]*pb.Issue, error) {
	event, err := eventByID(ctx, s.store, id)
	if err != nil {
		return nil, err
	}
	groups, err := s.groups(ctx)
	if err != nil {
		return nil, err
	}
	return check(ctx, s.store, attendance(event, groups), true)
}

func (s *Service) Publish(ctx context.Context, in *rpc.EventPublishRequest) (*rpc.EventPublishResponse, error) {
	groups, err := s.groups(ctx)
	if err != nil {
		return nil, err
	}
	result := &rpc.EventPublishResponse{}
	err = s.store.Write(ctx, func(tx *storage.Storage) error {
		e, err := eventByID(ctx, tx, in.Id)
		if err != nil {
			return err
		}
		if err := requireRevision(e, in.Revision, draft); err != nil {
			return err
		}
		events := []models.Event{e}
		if in.Series && e.SeriesID != nil {
			events, err = tx.Series(ctx, *e.SeriesID)
			if err != nil {
				return err
			}
		}
		var dates []time.Time
		for _, event := range events {
			if event.Date != nil {
				dates = append(dates, *event.Date)
			}
		}
		dates = slices.Compact(dates)
		rows, err := tx.Availability(ctx, dates)
		if err != nil {
			return err
		}
		c := catalogFromRows(rows)
		occupied, err := tx.OccupiedEvents(ctx, dates, true)
		if err != nil {
			return err
		}
		days := eventsByDate(occupied)
		for _, event := range events {
			var scheduled []models.Event
			if event.Date != nil {
				scheduled = days[*event.Date]
			}
			issues := c.check(attendance(event, groups), scheduled, true)
			result.Issues = append(result.Issues, issues...)
		}
		if hasBlockingIssue(result.Issues) {
			return nil
		}
		ids := make([]string, 0, len(events))
		for _, event := range events {
			ids = append(ids, event.ID)
		}
		if err := tx.PublishEvents(ctx, ids); err != nil {
			return err
		}
		for _, event := range events {
			event.Status = published
			event.Revision++
			result.Events = append(result.Events, eventProto(event, c))
		}
		return nil
	})
	return result, err
}

func check(ctx context.Context, store *storage.Storage, e models.Event, drafts bool) ([]*pb.Issue, error) {
	if !e.Timed() {
		return (catalog{}).check(e, nil, false), nil
	}
	dates := []time.Time{*e.Date}
	rows, err := store.Availability(ctx, dates)
	if err != nil {
		return nil, err
	}
	events, err := store.OccupiedEvents(ctx, dates, drafts)
	if err != nil {
		return nil, err
	}
	return catalogFromRows(rows).check(e, events, false), nil
}

func (s *Service) Slots(ctx context.Context, in *rpc.SlotsFetchRequest, canEdit bool) (*rpc.SlotsFetchResponse, error) {
	if in.ExcludeEventId != "" && !canEdit {
		return nil, denied()
	}
	from, to, err := dateRange(in.DateFrom, in.DateTo, 31)
	if err != nil {
		return nil, err
	}
	c, err := loadCatalog(ctx, s.store, false)
	if err != nil {
		return nil, err
	}
	details, err := c.event(in.Details)
	if err != nil {
		return nil, err
	}
	groups, err := s.groups(ctx)
	if err != nil {
		return nil, err
	}
	details = attendance(details, groups)
	term := c.terms[details.TermID]
	if from.Before(term.DateFrom) || to.After(term.DateTo) || details.DurationMinutes <= 0 || details.ExpectedAttendance <= 0 {
		return nil, invalid("укажите длительность, число участников и период в пределах семестра")
	}
	var original models.Event
	if in.ExcludeEventId != "" {
		original, err = eventByID(ctx, s.store, in.ExcludeEventId)
		if err != nil {
			return nil, err
		}
		details.ID = original.ID
	}
	var dates []time.Time
	for date := from; !date.After(to); date = date.AddDate(0, 0, 1) {
		dates = append(dates, date)
	}
	rows, err := s.store.Availability(ctx, dates)
	if err != nil {
		return nil, err
	}
	events, err := s.store.OccupiedEvents(ctx, dates, canEdit)
	if err != nil {
		return nil, err
	}
	rows.Rooms = c.Rooms
	return catalogFromRows(rows).availableSlots(details, original, from, to, eventsByDate(events)), nil
}

func eventsByDate(events []models.Event) map[time.Time][]models.Event {
	days := make(map[time.Time][]models.Event)
	for _, e := range events {
		if e.Date != nil {
			days[*e.Date] = append(days[*e.Date], e)
		}
	}
	return days
}

func (c catalog) availableSlots(details, original models.Event, from, to time.Time, days map[time.Time][]models.Event) *rpc.SlotsFetchResponse {
	rooms := c.Rooms
	if details.RoomID != nil {
		rooms = []models.Room{details.Room}
	} else if i := slices.IndexFunc(rooms, func(room models.Room) bool { return room.ID == original.Room.ID }); i > 0 {
		rooms = slices.Clone(rooms)
		preferred := rooms[i]
		copy(rooms[1:i+1], c.Rooms[:i])
		rooms[0] = preferred
	}
	starts := slotStarts(rooms, details.DurationMinutes)
	var preferredDate *time.Time
	var preferredStarts []int32
	if original.ID != "" {
		preferred := details
		if !preferred.Timed() {
			preferred = original
		}
		if preferred.Timed() {
			preferredDate = preferred.Date
			preferredStarts = slices.Clone(starts)
			minute := *preferred.StartMinute
			if !slices.Contains(preferredStarts, minute) {
				preferredStarts = append(preferredStarts, minute)
			}
			slices.SortStableFunc(preferredStarts, func(a, b int32) int {
				return cmp.Compare(max(a-minute, minute-a), max(b-minute, minute-b))
			})
		}
	}
	point, siteID := details.MeetingPoint, details.Room.SiteID
	if siteID == "" {
		siteID = original.Room.SiteID
	}
	result := &rpc.SlotsFetchResponse{}
	blockers := make(map[scheduleenum.IssueType]bool)
	for day := from; !day.After(to); day = day.AddDate(0, 0, 1) {
		dailyStarts := starts
		preferredDay := preferredDate != nil && day.Equal(*preferredDate)
		if preferredDay {
			dailyStarts = preferredStarts
		}
		for _, start := range dailyStarts {
			for _, room := range rooms {
				if start < room.OpensAt || start+details.DurationMinutes > room.ClosesAt ||
					(original.Timed() && day.Equal(*original.Date) && start == *original.StartMinute && room.ID == original.Room.ID) {
					continue
				}
				details.Room, details.RoomID, details.Date, details.StartMinute = room, &room.ID, &day, &start
				details.MeetingPoint = point
				if details.Type == scheduleenum.EventType_EVENT_TYPE_CLINICAL_CYCLE && (point == "" || (siteID != "" && siteID != room.SiteID)) {
					details.MeetingPoint = room.Site.MeetingPoint
				}
				issues := c.check(details, days[day], false)
				for _, issue := range issues {
					if !blockers[issue.Type] {
						blockers[issue.Type] = true
						result.Issues = append(result.Issues, issue)
					}
				}
				if len(issues) == 0 {
					result.Slots = append(result.Slots, &pb.Slot{
						Date: day.Format(time.DateOnly), StartMinute: start, DurationMinutes: details.DurationMinutes, Room: roomProto(room),
					})
					if len(result.Slots) == 12 {
						result.Issues = nil
						return result
					}
					if !preferredDay || start != preferredStarts[0] {
						break
					}
				}
			}
		}
	}
	if len(result.Slots) != 0 {
		result.Issues = nil
	} else if len(result.Issues) == 0 {
		result.Issues = []*pb.Issue{{Type: scheduleenum.IssueType_ISSUE_TYPE_AVAILABILITY, Message: "Нет площадок с подходящими часами работы"}}
	}
	return result
}

func slotStarts(rooms []models.Room, duration int32) []int32 {
	var available [1440]bool
	for _, room := range rooms {
		for start := room.OpensAt; start+duration <= room.ClosesAt; start += 15 {
			available[start] = true
		}
	}
	var starts []int32
	for minute, open := range available {
		if open {
			starts = append(starts, int32(minute))
		}
	}
	return starts
}

func eventByID(ctx context.Context, store *storage.Storage, id string) (models.Event, error) {
	if !validID(id) {
		return models.Event{}, invalid("некорректный идентификатор занятия")
	}
	event, err := store.Event(ctx, id)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return event, connect.NewError(connect.CodeNotFound, errors.New("занятие не найдено"))
	}
	return event, err
}

func requireRevision(event models.Event, revision int32, status scheduleenum.EventStatus) error {
	if event.Revision != revision || event.Status != status {
		return connect.NewError(connect.CodeFailedPrecondition, errors.New("занятие изменилось, обновите расписание"))
	}
	return nil
}

func denied() error {
	return connect.NewError(connect.CodePermissionDenied, errors.New("недостаточно прав"))
}

func newID() string {
	return rand.Text()
}

func validID(id string) bool {
	return len(id) == 26 && strings.IndexFunc(id, func(c rune) bool {
		return !(c >= 'A' && c <= 'Z' || c >= '2' && c <= '7')
	}) == -1
}
