package models

import (
	"errors"
	"fmt"
	"time"

	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	entity "dvgmu/api/contract/gen/go/entity/v1"
)

var (
	ErrScheduleNotFound = errors.New("schedule not found")
	// ErrScheduleInvalid wraps every validation failure; the message says which rule broke.
	ErrScheduleInvalid = errors.New("invalid schedule")
)

// Schedule is the stored form of a faculty timetable. A timetable is always
// read and written as a whole, so its parts are kept as one JSON document (the
// contract message itself); only what the list is filtered and ordered by is
// lifted into columns.
type Schedule struct {
	ID            string `gorm:"primaryKey;size:64"`
	ProgramID     string `gorm:"size:64;not null;index:idx_schedule_timetables_program_course,priority:1"`
	Course        int32  `gorm:"not null;index:idx_schedule_timetables_program_course,priority:2"`
	Title         string `gorm:"size:255;not null"`
	SemesterStart string `gorm:"size:10;not null"`
	Body          string `gorm:"type:jsonb;not null"`

	CreatedAt time.Time `gorm:"not null"`
	UpdatedAt time.Time `gorm:"not null"`
}

func (Schedule) TableName() string { return "schedule_timetables" }

// ScheduleFilter narrows the list; zero values mean "any".
type ScheduleFilter struct {
	ProgramID string
	Course    int32
}

var (
	scheduleMarshaler   = protojson.MarshalOptions{UseProtoNames: true}
	scheduleUnmarshaler = protojson.UnmarshalOptions{DiscardUnknown: true}
)

// NewSchedule validates and normalizes a timetable and serializes it. The id
// and timestamps live in columns, so they are cut from the body to keep a
// single source of truth.
func NewSchedule(t *entity.ScheduleTimetable) (*Schedule, error) {
	if err := ScheduleValidate(t); err != nil {
		return nil, err
	}
	ScheduleNormalize(t)

	body := proto.Clone(t).(*entity.ScheduleTimetable)
	body.Id = ""
	body.CreatedAt = nil
	body.UpdatedAt = nil

	raw, err := scheduleMarshaler.Marshal(body)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	return &Schedule{
		ID:            t.GetId(),
		ProgramID:     t.GetProgram().GetId(),
		Course:        t.GetCourse(),
		Title:         t.GetTitle(),
		SemesterStart: t.GetSemester().GetStart(),
		Body:          string(raw),
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

func (s *Schedule) ToProto() (*entity.ScheduleTimetable, error) {
	t := &entity.ScheduleTimetable{}
	if err := scheduleUnmarshaler.Unmarshal([]byte(s.Body), t); err != nil {
		return nil, fmt.Errorf("schedule %s: %w", s.ID, err)
	}
	t.Id = s.ID
	t.CreatedAt = timestamppb.New(s.CreatedAt)
	t.UpdatedAt = timestamppb.New(s.UpdatedAt)
	return t, nil
}
