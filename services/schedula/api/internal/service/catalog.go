package service

import (
	"context"
	"errors"
	"slices"
	"strings"
	"time"

	"connectrpc.com/connect"

	"dvgmu/schedula/internal/domain/models"
	"dvgmu/schedula/internal/storage"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
)

type catalog struct {
	storage.Catalog
	terms    map[string]models.Term
	subjects map[string]models.Subject
	rooms    map[string]models.Room
	periods  map[[3]string][]models.AcademicPeriod
	holidays map[time.Time]string
	travel   map[[2]string]int32
	bookings map[time.Time][]models.Booking
}

func loadCatalog(ctx context.Context, store *storage.Storage, detailed bool) (catalog, error) {
	rows, err := store.Catalog(ctx, detailed)
	if err != nil {
		return catalog{}, err
	}
	return catalogFromRows(rows), nil
}

func catalogFromRows(rows storage.Catalog) catalog {
	c := catalog{
		Catalog: rows, terms: make(map[string]models.Term), subjects: make(map[string]models.Subject),
		rooms: make(map[string]models.Room), periods: make(map[[3]string][]models.AcademicPeriod), holidays: make(map[time.Time]string),
		travel: make(map[[2]string]int32), bookings: make(map[time.Time][]models.Booking),
	}
	for _, term := range rows.Terms {
		c.terms[term.ID] = term
	}
	for _, subject := range rows.Subjects {
		c.subjects[subject.ID] = subject
	}
	for _, room := range rows.Rooms {
		c.rooms[room.ID] = room
	}
	for _, period := range rows.Periods {
		scope := [3]string{period.TermID, period.Group, period.Subgroup}
		c.periods[scope] = append(c.periods[scope], period)
	}
	for _, holiday := range rows.Holidays {
		c.holidays[holiday.Date] = holiday.Name
	}
	for _, travel := range rows.TravelTimes {
		c.travel[[2]string{travel.FromSiteID, travel.ToSiteID}] = travel.Minutes
	}
	for _, booking := range rows.Bookings {
		if !booking.Cancelled {
			c.bookings[booking.Date] = append(c.bookings[booking.Date], booking)
		}
	}
	return c
}

func (c catalog) event(in *pb.EventInput) (models.Event, error) {
	if in == nil {
		return models.Event{}, invalid("укажите параметры занятия")
	}
	term, ok := c.terms[in.TermId]
	if !ok {
		return models.Event{}, invalid("выберите семестр")
	}
	subject, ok := c.subjects[in.SubjectId]
	if !ok {
		return models.Event{}, invalid("выберите дисциплину из справочника")
	}
	if in.Type < scheduleenum.EventType_EVENT_TYPE_LECTURE || in.Type > scheduleenum.EventType_EVENT_TYPE_COMPUTER_CLASS_TEST {
		return models.Event{}, invalid("выберите тип события")
	}
	if len(in.Audiences) == 0 || len(in.Audiences) > 50 || in.ExpectedAttendance < 0 || in.DurationMinutes < 0 || in.DurationMinutes > 1440 {
		return models.Event{}, invalid("проверьте группы, длительность и число участников")
	}
	e := models.Event{
		TermID: term.ID, SubjectID: subject.ID, Subject: subject, Type: in.Type,
		InstructorID: strings.TrimSpace(in.InstructorId), Department: strings.TrimSpace(in.Department),
		DurationMinutes: in.DurationMinutes, ExpectedAttendance: in.ExpectedAttendance,
		MeetingPoint: strings.TrimSpace(in.MeetingPoint), Equipment: in.Equipment,
	}
	seen := make(map[[2]string]struct{}, len(in.Audiences))
	courses := make(map[string]int32)
	for _, input := range in.Audiences {
		a := audience(input)
		if !validAudience(a) {
			return models.Event{}, invalid("укажите группу и курс")
		}
		key := [2]string{a.Group, a.Subgroup}
		if _, exists := seen[key]; exists {
			return models.Event{}, invalid("группа или подгруппа указана несколько раз")
		}
		if course := courses[a.Group]; course != 0 && course != a.Course {
			return models.Event{}, invalid("одна группа должна относиться к одному курсу")
		}
		courses[a.Group] = a.Course
		seen[key] = struct{}{}
		e.Audiences = append(e.Audiences, a)
	}
	if in.Date != "" {
		d, err := date(in.Date)
		if err != nil {
			return models.Event{}, err
		}
		if d.Before(term.DateFrom) || d.After(term.DateTo) {
			return models.Event{}, invalid("дата занятия выходит за границы семестра")
		}
		e.Date = &d
	}
	if in.StartMinute != nil {
		if e.Date == nil || !validTime(*in.StartMinute, in.DurationMinutes) {
			return models.Event{}, invalid("время и длительность должны укладываться в один день")
		}
		e.StartMinute = in.StartMinute
	}
	if in.RoomId != "" {
		room, ok := c.rooms[in.RoomId]
		if !ok {
			return models.Event{}, invalid("выберите площадку из справочника")
		}
		e.RoomID, e.Room = &room.ID, room
	}
	return e, nil
}

func validTime(start, duration int32) bool {
	return start >= 0 && start < 1440 && duration > 0 && duration <= 1440-start
}

func audience(in *pb.Audience) models.Audience {
	return models.Audience{Group: strings.TrimSpace(in.GetGroup()), Subgroup: strings.TrimSpace(in.GetSubgroup()), Course: in.GetCourse()}
}

func validAudience(a models.Audience) bool {
	return a.Group != "" && len(a.Group) <= 128 && len(a.Subgroup) <= 128 && a.Course >= 1 && a.Course <= 6
}

func (s *Service) SaveCatalog(ctx context.Context, input *pb.Catalog) error {
	if input == nil {
		return invalid("передайте справочники")
	}
	var rows storage.Catalog
	for _, in := range input.Terms {
		from, to, err := dateRange(in.GetDateFrom(), in.GetDateTo(), 370)
		if err != nil {
			return err
		}
		if !named(in.Id, in.Name) {
			return invalid("укажите код и название семестра")
		}
		rows.Terms = append(rows.Terms, models.Term{ID: in.Id, Name: in.Name, DateFrom: from, DateTo: to})
	}
	for _, in := range input.Subjects {
		if !named(in.GetId(), in.GetName()) {
			return invalid("укажите код и название дисциплины")
		}
		rows.Subjects = append(rows.Subjects, models.Subject{ID: in.Id, Name: strings.TrimSpace(in.Name)})
	}
	for _, in := range input.Sites {
		if !named(in.GetId(), in.GetName()) || strings.TrimSpace(in.Address) == "" {
			return invalid("укажите код, название и адрес корпуса")
		}
		rows.Sites = append(rows.Sites, models.Site{ID: in.Id, Name: in.Name, Address: in.Address, MeetingPoint: in.MeetingPoint, Clinical: in.Clinical})
	}
	for _, in := range input.Rooms {
		if !named(in.GetId(), in.GetName()) || in.GetSite().GetId() == "" || in.Capacity <= 0 || in.OpensAt < 0 || in.ClosesAt <= in.OpensAt || in.ClosesAt > 1440 {
			return invalid("укажите корпус, вместимость и часы работы площадки")
		}
		rows.Rooms = append(rows.Rooms, models.Room{ID: in.Id, Name: in.Name, SiteID: in.Site.Id, Capacity: in.Capacity, Equipment: in.Equipment, OpensAt: in.OpensAt, ClosesAt: in.ClosesAt})
	}
	for _, in := range input.Periods {
		from, to, err := dateRange(in.GetDateFrom(), in.GetDateTo(), 370)
		if err != nil {
			return err
		}
		a := audience(in.Audience)
		if !named(in.Id, in.TermId) || !validAudience(a) || in.Type < scheduleenum.PeriodType_PERIOD_TYPE_CLASSES || in.Type > scheduleenum.PeriodType_PERIOD_TYPE_HOLIDAYS {
			return invalid("укажите семестр, группу и тип учебного периода")
		}
		rows.Periods = append(rows.Periods, models.AcademicPeriod{
			ID: in.Id, TermID: in.TermId, Group: a.Group, Subgroup: a.Subgroup, Course: a.Course,
			Type: in.Type, DateFrom: from, DateTo: to,
		})
	}
	for _, in := range input.Holidays {
		d, err := date(in.GetDate())
		if err != nil {
			return err
		}
		if strings.TrimSpace(in.Name) == "" {
			return invalid("укажите название праздника")
		}
		rows.Holidays = append(rows.Holidays, models.Holiday{Date: d, Name: in.Name})
	}
	for _, in := range input.TravelTimes {
		if !named(in.GetFromSiteId(), in.GetToSiteId()) || in.FromSiteId == in.ToSiteId || in.Minutes < 0 || in.Minutes > 1440 {
			return invalid("укажите разные корпуса и время перехода")
		}
		rows.TravelTimes = append(rows.TravelTimes, models.TravelTime{FromSiteID: in.FromSiteId, ToSiteID: in.ToSiteId, Minutes: in.Minutes})
	}
	for _, in := range input.Bookings {
		d, err := date(in.GetDate())
		if err != nil {
			return err
		}
		if !named(in.Id, in.Title) || in.RoomId == "" || !validTime(in.StartMinute, in.DurationMinutes) {
			return invalid("укажите площадку, название и время брони")
		}
		rows.Bookings = append(rows.Bookings, models.Booking{
			ID: in.Id, RoomID: in.RoomId, Date: d, StartMinute: in.StartMinute, DurationMinutes: in.DurationMinutes,
			Title: in.Title, Cancelled: in.Cancelled,
		})
	}

	return s.store.Write(ctx, func(tx *storage.Storage) error {
		if err := tx.SaveCatalog(ctx, rows); err != nil {
			return err
		}
		c, err := loadCatalog(ctx, tx, true)
		if err != nil {
			return err
		}
		for _, period := range c.Periods {
			term := c.terms[period.TermID]
			if period.DateFrom.Before(term.DateFrom) || period.DateTo.After(term.DateTo) {
				return invalid("учебный период выходит за границы семестра")
			}
		}
		for _, period := range rows.Periods {
			if slices.ContainsFunc(c.Periods, func(other models.AcademicPeriod) bool { return periodsOverlap(period, other) }) {
				return invalid("учебные периоды одной группы или подгруппы пересекаются")
			}
		}
		for _, term := range rows.Terms {
			if err := tx.ValidateTerm(ctx, term); err != nil {
				return err
			}
		}
		for _, booking := range rows.Bookings {
			if booking.Cancelled {
				continue
			}
			events, err := tx.OccupiedEvents(ctx, []time.Time{booking.Date}, false)
			if err != nil {
				return err
			}
			room := c.rooms[booking.RoomID]
			end := booking.StartMinute + booking.DurationMinutes
			if booking.StartMinute < room.OpensAt || end > room.ClosesAt || c.holidays[booking.Date] != "" {
				return invalid("площадка недоступна во время брони")
			}
			for _, other := range c.bookings[booking.Date] {
				if other.ID != booking.ID && other.RoomID == booking.RoomID && intersects(booking.StartMinute, end, other.StartMinute, other.StartMinute+other.DurationMinutes) {
					return alreadyBooked()
				}
			}
			for _, event := range events {
				if event.Room.ID == booking.RoomID && intersects(booking.StartMinute, end, *event.StartMinute, event.EndMinute()) {
					return alreadyBooked()
				}
			}
		}
		return nil
	})
}

func periodsOverlap(a, b models.AcademicPeriod) bool {
	return a.ID != b.ID && a.TermID == b.TermID && a.Group == b.Group && a.Subgroup == b.Subgroup &&
		!a.DateFrom.After(b.DateTo) && !b.DateFrom.After(a.DateTo)
}

func named(id, name string) bool {
	return id == strings.TrimSpace(id) && id != "" && len(id) <= 128 && strings.TrimSpace(name) != ""
}

func alreadyBooked() error {
	return connect.NewError(connect.CodeFailedPrecondition, errors.New("площадка уже занята"))
}

func (s *Service) Catalog(ctx context.Context, canEdit bool) (*pb.Catalog, error) {
	c, err := s.store.Catalog(ctx, canEdit)
	if err != nil {
		return nil, err
	}
	result := &pb.Catalog{}
	for _, t := range c.Terms {
		result.Terms = append(result.Terms, &pb.Term{Id: t.ID, Name: t.Name, DateFrom: t.DateFrom.Format(time.DateOnly), DateTo: t.DateTo.Format(time.DateOnly)})
	}
	for _, subject := range c.Subjects {
		result.Subjects = append(result.Subjects, subjectProto(subject))
	}
	for _, site := range c.Sites {
		result.Sites = append(result.Sites, siteProto(site))
	}
	for _, room := range c.Rooms {
		result.Rooms = append(result.Rooms, roomProto(room))
	}
	if !canEdit {
		return result, nil
	}
	for _, period := range c.Periods {
		result.Periods = append(result.Periods, periodProto(period))
	}
	for _, holiday := range c.Holidays {
		result.Holidays = append(result.Holidays, &pb.Holiday{Date: holiday.Date.Format(time.DateOnly), Name: holiday.Name})
	}
	for _, travel := range c.TravelTimes {
		result.TravelTimes = append(result.TravelTimes, &pb.TravelTime{FromSiteId: travel.FromSiteID, ToSiteId: travel.ToSiteID, Minutes: travel.Minutes})
	}
	for _, booking := range c.Bookings {
		result.Bookings = append(result.Bookings, &pb.Booking{
			Id: booking.ID, RoomId: booking.RoomID, Date: booking.Date.Format(time.DateOnly),
			StartMinute: booking.StartMinute, DurationMinutes: booking.DurationMinutes, Title: booking.Title, Cancelled: booking.Cancelled,
		})
	}
	return result, nil
}
