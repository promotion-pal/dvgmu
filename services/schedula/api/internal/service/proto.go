package service

import (
	"time"

	"dvgmu/schedula/internal/domain/models"
	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
)

func eventProto(e models.Event, c catalog) *pb.Event {
	status := e.Status
	if status == published && e.Date != nil && c.holidays[*e.Date] != "" {
		status = scheduleenum.EventStatus_EVENT_STATUS_TRANSFER
	}
	return eventSnapshot(e, status)
}

func eventSnapshot(e models.Event, status scheduleenum.EventStatus) *pb.Event {
	in := &pb.EventInput{
		TermId: e.TermID, SubjectId: e.SubjectID, Type: e.Type,
		InstructorId: e.InstructorID, Department: e.Department, StartMinute: e.StartMinute,
		DurationMinutes: e.DurationMinutes, MeetingPoint: e.MeetingPoint,
		ExpectedAttendance: e.ExpectedAttendance, Equipment: e.Equipment,
	}
	if e.Date != nil {
		in.Date = e.Date.Format(time.DateOnly)
	}
	for _, a := range e.Audiences {
		in.Audiences = append(in.Audiences, &pb.Audience{Group: a.Group, Subgroup: a.Subgroup, Course: a.Course})
	}
	result := &pb.Event{Id: e.ID, Revision: e.Revision, Status: status, Details: in, Subject: subjectProto(e.Subject), Change: e.ChangeType}
	if e.RoomID != nil {
		in.RoomId = *e.RoomID
		result.Room = roomProto(e.Room)
	}
	if e.SeriesID != nil {
		result.SeriesId = *e.SeriesID
	}
	return result
}

func publicEventProto(e models.Event) *pb.PublicEvent {
	result := &pb.PublicEvent{
		Id: e.ID, Type: e.Type, Status: e.Status, Subject: subjectProto(e.Subject), Date: e.Date.Format(time.DateOnly),
		StartMinute: *e.StartMinute, DurationMinutes: e.DurationMinutes, Room: e.Room.Name,
		Site: e.Room.Site.Name, Address: e.Room.Site.Address, Change: e.ChangeType,
	}
	seen := make(map[string]bool)
	for _, a := range e.Audiences {
		if !seen[a.Group] {
			seen[a.Group] = true
			result.Groups = append(result.Groups, a.Group)
		}
	}
	return result
}

func subjectProto(s models.Subject) *pb.Subject {
	return &pb.Subject{Id: s.ID, Name: s.Name}
}

func siteProto(s models.Site) *pb.Site {
	return &pb.Site{Id: s.ID, Name: s.Name, Address: s.Address, MeetingPoint: s.MeetingPoint, Clinical: s.Clinical}
}

func roomProto(r models.Room) *pb.Room {
	return &pb.Room{Id: r.ID, Name: r.Name, Capacity: r.Capacity, Equipment: r.Equipment, OpensAt: r.OpensAt, ClosesAt: r.ClosesAt, Site: siteProto(r.Site)}
}

func periodProto(p models.AcademicPeriod) *pb.AcademicPeriod {
	return &pb.AcademicPeriod{
		Id: p.ID, TermId: p.TermID, Type: p.Type, DateFrom: p.DateFrom.Format(time.DateOnly), DateTo: p.DateTo.Format(time.DateOnly),
		Audience: &pb.Audience{Group: p.Group, Subgroup: p.Subgroup, Course: p.Course},
	}
}

func changeProto(c models.Change) *pb.Change {
	result := &pb.Change{
		Id: c.ID, Type: c.Type, Status: c.Status, Before: eventSnapshot(c.Before, c.Before.Status), After: eventSnapshot(c.After, c.After.Status),
		Reason: c.Reason, AuthorId: c.AuthorID, SubmittedAt: c.SubmittedAt.UTC().Format(time.RFC3339),
		ReviewerId: c.ReviewerID, Decision: c.Decision,
	}
	if c.DecidedAt != nil {
		result.DecidedAt = c.DecidedAt.UTC().Format(time.RFC3339)
	}
	return result
}
