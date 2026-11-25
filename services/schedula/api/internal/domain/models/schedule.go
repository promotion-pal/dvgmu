package models

import (
	"time"

	pb "fesmu/contract/schedula/entity"
	scheduleenum "fesmu/contract/schedula/enum"
)

type Term struct {
	ID       string
	Name     string
	DateFrom time.Time
	DateTo   time.Time
}

type Subject struct {
	ID   string
	Name string
}

type Site struct {
	ID           string
	Name         string
	Address      string
	MeetingPoint string
	Clinical     bool
}

type Room struct {
	ID        string
	Name      string
	SiteID    string
	Capacity  int32
	Equipment []string `gorm:"serializer:json;type:jsonb"`
	OpensAt   int32
	ClosesAt  int32
	Site      Site
}

type Audience struct {
	Group    string
	Subgroup string
	Course   int32
}

type AcademicPeriod struct {
	ID       string
	TermID   string
	Group    string
	Subgroup string
	Course   int32
	Type     scheduleenum.PeriodType
	DateFrom time.Time
	DateTo   time.Time
}

type Holiday struct {
	Date time.Time `gorm:"primaryKey"`
	Name string
}

type TravelTime struct {
	FromSiteID string `gorm:"primaryKey"`
	ToSiteID   string `gorm:"primaryKey"`
	Minutes    int32
}

type Booking struct {
	ID              string
	RoomID          string
	Date            time.Time
	StartMinute     int32
	DurationMinutes int32
	Title           string
	Cancelled       bool
}

type Event struct {
	ID                 string
	Revision           int32
	Status             scheduleenum.EventStatus
	TermID             string
	SubjectID          string
	Type               scheduleenum.EventType
	Audiences          []Audience `gorm:"serializer:json;type:jsonb"`
	InstructorID       string
	Department         string
	Date               *time.Time
	StartMinute        *int32
	DurationMinutes    int32
	RoomID             *string
	MeetingPoint       string
	ExpectedAttendance int32
	Equipment          []string `gorm:"serializer:json;type:jsonb"`
	SeriesID           *string
	ChangeType         scheduleenum.ChangeType
	AuthorID           string
	CreatedAt          time.Time
	UpdatedAt          time.Time
	Subject            Subject
	Room               Room
}

func (e Event) EndMinute() int32 {
	return *e.StartMinute + e.DurationMinutes
}

func (e Event) Timed() bool {
	return e.Date != nil && e.StartMinute != nil && e.DurationMinutes > 0
}

func (e Event) Reference() *pb.EventReference {
	ref := &pb.EventReference{
		Id: e.ID, Title: e.Subject.Name, StartMinute: e.StartMinute, DurationMinutes: e.DurationMinutes,
	}
	if e.Date != nil {
		ref.Date = e.Date.Format(time.DateOnly)
	}
	return ref
}

type Change struct {
	ID            string
	EventID       string
	EventRevision int32
	Type          scheduleenum.ChangeType
	Status        scheduleenum.ChangeStatus
	Before        Event `gorm:"serializer:json;type:jsonb"`
	After         Event `gorm:"serializer:json;type:jsonb"`
	Reason        string
	AuthorID      string
	SubmittedAt   time.Time
	ReviewerID    string
	DecidedAt     *time.Time
	Decision      string
}
