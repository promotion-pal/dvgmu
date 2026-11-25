package models

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"
)

var (
	ErrComputerClassSessionNotFound = errors.New("computer class session not found")
	// ErrComputerClassSessionInvalid wraps every validation failure; the message says which rule broke.
	ErrComputerClassSessionInvalid = errors.New("invalid computer class session")
)

// ComputerClassSession is a lesson or computer testing held in a room on a
// date, from TimeStart to TimeEnd. Sessions of one room may overlap: the
// timetable highlights the clash and staff resolve it by editing.
type ComputerClassSession struct {
	ID int64 `gorm:"primaryKey;autoIncrement"`

	Date      string `gorm:"size:10;not null;index:idx_computer_class_sessions_date_room,priority:1"`
	TimeStart string `gorm:"size:5;not null"`
	TimeEnd   string `gorm:"size:5;not null"`
	Room      string `gorm:"size:255;not null;index:idx_computer_class_sessions_date_room,priority:2"`

	Kind enum.ComputerClassSessionKind `gorm:"type:smallint;not null;default:1"`

	Title  string `gorm:"size:255;not null"`
	Groups string `gorm:"size:255;not null;default:''"`
	Note   string `gorm:"size:1024;not null;default:''"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (s *ComputerClassSession) ToProto() *entity.ComputerClassSession {
	return &entity.ComputerClassSession{
		Id:        s.ID,
		Date:      s.Date,
		TimeStart: s.TimeStart,
		TimeEnd:   s.TimeEnd,
		Room:      s.Room,
		Kind:      s.Kind,
		Title:     s.Title,
		Groups:    s.Groups,
		Note:      s.Note,
		CreatedAt: timestamppb.New(s.CreatedAt),
		UpdatedAt: timestamppb.New(s.UpdatedAt),
	}
}

// ComputerClassSessionFilter narrows the list; zero values mean "any". Dates are inclusive.
type ComputerClassSessionFilter struct {
	Room     string
	DateFrom string
	DateTo   string
	Kind     enum.ComputerClassSessionKind
}

type ComputerClassSessionParams struct {
	Date      string
	TimeStart string
	TimeEnd   string
	Room      string
	Kind      enum.ComputerClassSessionKind
	Title     string
	Groups    string
	Note      string
}

var computerClassClockRe = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

func NewComputerClassSession(params ComputerClassSessionParams, now time.Time) (*ComputerClassSession, error) {
	s := &ComputerClassSession{
		Date:      params.Date,
		TimeStart: params.TimeStart,
		TimeEnd:   params.TimeEnd,
		Room:      strings.TrimSpace(params.Room),
		Kind:      params.Kind,
		Title:     strings.TrimSpace(params.Title),
		Groups:    strings.TrimSpace(params.Groups),
		Note:      strings.TrimSpace(params.Note),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.Validate(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *ComputerClassSession) Validate() error {
	if _, err := time.Parse("2006-01-02", s.Date); err != nil {
		return computerClassInvalid("дата должна быть в формате ГГГГ-ММ-ДД")
	}
	if !computerClassClockRe.MatchString(s.TimeStart) || !computerClassClockRe.MatchString(s.TimeEnd) {
		return computerClassInvalid("время должно быть в формате ЧЧ:ММ")
	}
	// HH:MM strings compare in time order.
	if s.TimeEnd <= s.TimeStart {
		return computerClassInvalid("время окончания должно быть позже начала")
	}
	if s.Room == "" {
		return computerClassInvalid("укажите кабинет")
	}
	if _, ok := enum.ComputerClassSessionKind_name[int32(s.Kind)]; !ok || s.Kind == enum.ComputerClassSessionKind_COMPUTER_CLASS_SESSION_KIND_UNSPECIFIED {
		return computerClassInvalid("выберите, что проходит: занятие или тестирование")
	}
	if s.Title == "" {
		return computerClassInvalid("укажите, что проходит в классе")
	}
	return nil
}

func computerClassInvalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrComputerClassSessionInvalid, msg)
}
