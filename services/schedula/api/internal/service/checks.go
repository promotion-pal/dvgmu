package service

import (
	"fmt"
	"slices"
	"time"

	"dvgmu/schedula/internal/domain/models"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
)

func (c catalog) check(event models.Event, events []models.Event, allowTransfer bool) []*pb.Issue {
	var issues []*pb.Issue
	add := func(kind scheduleenum.IssueType, message string, other *pb.EventReference) {
		issues = append(issues, &pb.Issue{Type: kind, Message: message, Event: event.Reference(), ConflictingEvent: other})
	}
	if !event.Timed() {
		add(scheduleenum.IssueType_ISSUE_TYPE_TIME, "Не указаны дата, время или длительность", nil)
	}
	if event.RoomID == nil {
		add(scheduleenum.IssueType_ISSUE_TYPE_ROOM, "Не назначена площадка", nil)
	}
	if event.InstructorID == "" && event.Type != scheduleenum.EventType_EVENT_TYPE_COMPUTER_CLASS_TEST {
		add(scheduleenum.IssueType_ISSUE_TYPE_AUDIENCE, "Не назначен преподаватель или наставник", nil)
	}
	if event.ExpectedAttendance == 0 {
		add(scheduleenum.IssueType_ISSUE_TYPE_AUDIENCE, "Не указано число участников", nil)
	}
	if event.Type == scheduleenum.EventType_EVENT_TYPE_CLINICAL_CYCLE {
		if event.InstructorID == "" || event.Department == "" || event.MeetingPoint == "" ||
			!event.Room.Site.Clinical || event.Room.Site.Address == "" || slices.ContainsFunc(event.Audiences, func(a models.Audience) bool {
			return a.Course < 4 || a.Subgroup == ""
		}) {
			add(scheduleenum.IssueType_ISSUE_TYPE_CLINICAL_DETAILS, "Для клинического цикла укажите подгруппу старшего курса, кафедру, наставника, клиническую базу и точку сбора", nil)
		}
	}
	if event.RoomID != nil {
		if event.ExpectedAttendance > event.Room.Capacity {
			add(scheduleenum.IssueType_ISSUE_TYPE_CAPACITY, fmt.Sprintf("Участников %d, мест %d", event.ExpectedAttendance, event.Room.Capacity), nil)
		}
		for _, item := range event.Equipment {
			if !slices.Contains(event.Room.Equipment, item) {
				add(scheduleenum.IssueType_ISSUE_TYPE_EQUIPMENT, "Нет оборудования «"+item+"»", nil)
			}
		}
	}
	if !event.Timed() {
		return issues
	}
	if holiday := c.holidays[*event.Date]; holiday != "" {
		if !allowTransfer {
			add(scheduleenum.IssueType_ISSUE_TYPE_HOLIDAY, "Требуется перенос. "+holiday, nil)
		}
		return issues
	}
	start, end := *event.StartMinute, event.EndMinute()
	if event.RoomID != nil {
		if start < event.Room.OpensAt || end > event.Room.ClosesAt {
			add(scheduleenum.IssueType_ISSUE_TYPE_AVAILABILITY, fmt.Sprintf("Площадка доступна с %s до %s", clock(event.Room.OpensAt), clock(event.Room.ClosesAt)), nil)
		}
		for _, booking := range c.bookings[*event.Date] {
			if booking.RoomID != *event.RoomID || !intersects(start, end, booking.StartMinute, booking.StartMinute+booking.DurationMinutes) {
				continue
			}
			add(scheduleenum.IssueType_ISSUE_TYPE_BOOKING, "На это время есть бронь", &pb.EventReference{
				Id: booking.ID, Title: booking.Title, Date: booking.Date.Format(time.DateOnly),
				StartMinute: &booking.StartMinute, DurationMinutes: booking.DurationMinutes,
			})
		}
	}
	for _, other := range events {
		if (event.ID != "" && event.ID == other.ID) || other.Status == cancelled || !other.Timed() || !other.Date.Equal(*event.Date) {
			continue
		}
		sameInstructor := event.InstructorID != "" && event.InstructorID == other.InstructorID
		sameAudience := sharesAudience(event.Audiences, other.Audiences)
		if intersects(start, end, *other.StartMinute, other.EndMinute()) {
			if sameInstructor {
				add(scheduleenum.IssueType_ISSUE_TYPE_INSTRUCTOR, "Преподаватель уже занят", other.Reference())
			}
			if sameAudience {
				add(scheduleenum.IssueType_ISSUE_TYPE_GROUP, "Группа или подгруппа уже занята", other.Reference())
			}
			if event.RoomID != nil && other.RoomID != nil && *event.RoomID == *other.RoomID {
				add(scheduleenum.IssueType_ISSUE_TYPE_ROOM, "Площадка уже занята", other.Reference())
			}
			continue
		}
		if !(sameAudience || sameInstructor) || event.Room.SiteID == "" || other.Room.SiteID == "" {
			continue
		}
		first, second := event, other
		if start > *other.StartMinute {
			first, second = other, event
		}
		gap := *second.StartMinute - first.EndMinute()
		minutes := c.travel[[2]string{first.Room.SiteID, second.Room.SiteID}]
		if gap < minutes && needsTravel(first, second, events) {
			add(scheduleenum.IssueType_ISSUE_TYPE_TRAVEL, fmt.Sprintf("На переход %d мин, требуется %d мин", gap, minutes), other.Reference())
		}
	}
	return issues
}

func needsTravel(first, second models.Event, events []models.Event) bool {
	var between []models.Event
	for _, event := range events {
		if event.Status != cancelled && event.Timed() && event.Date.Equal(*first.Date) &&
			*event.StartMinute >= first.EndMinute() && event.EndMinute() <= *second.StartMinute {
			between = append(between, event)
		}
	}
	if first.InstructorID != "" && first.InstructorID == second.InstructorID &&
		!slices.ContainsFunc(between, func(event models.Event) bool { return event.InstructorID == first.InstructorID }) {
		return true
	}
	for _, a := range first.Audiences {
		for _, b := range second.Audiences {
			if !audiencesOverlap(a, b) {
				continue
			}
			shared := a
			if a.Subgroup == "" {
				shared = b
			}
			covered := slices.ContainsFunc(between, func(event models.Event) bool {
				return slices.ContainsFunc(event.Audiences, func(a models.Audience) bool {
					return a.Group == shared.Group && (a.Subgroup == "" || a.Subgroup == shared.Subgroup)
				})
			})
			if !covered {
				return true
			}
		}
	}
	return false
}

func intersects(from, to, otherFrom, otherTo int32) bool {
	return from < otherTo && otherFrom < to
}

func sharesAudience(first, second []models.Audience) bool {
	for _, a := range first {
		for _, b := range second {
			if audiencesOverlap(a, b) {
				return true
			}
		}
	}
	return false
}

func audiencesOverlap(a, b models.Audience) bool {
	return a.Group == b.Group && (a.Subgroup == "" || b.Subgroup == "" || a.Subgroup == b.Subgroup)
}

func clock(minute int32) string {
	return fmt.Sprintf("%02d:%02d", minute/60, minute%60)
}
