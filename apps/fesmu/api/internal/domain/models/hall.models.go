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
	ErrHallNotFound        = errors.New("hall not found")
	ErrHallBookingNotFound = errors.New("hall booking not found")
	// ErrHallBookingTaken: the requested time overlaps another booking of the hall.
	ErrHallBookingTaken = errors.New("зал уже занят в это время")
	// ErrHallBookingInvalid wraps every validation failure; the message says which rule broke.
	ErrHallBookingInvalid = errors.New("invalid hall booking")
)

// The hall's working day: a booking must fit inside it. The public booking
// page (widgets/schedule/schedule_hall_booking) mirrors these bounds.
const (
	HallDayStart = "08:00"
	HallDayEnd   = "20:00"
)

// Hall is a bookable lecture hall / auditorium.
type Hall struct {
	ID int64 `gorm:"primaryKey;autoIncrement"`

	Name     string `gorm:"size:255;not null"`
	Building string `gorm:"size:255"`
	Tone     string `gorm:"size:32;not null"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (h *Hall) ToProto() *entity.Hall {
	return &entity.Hall{
		Id:        h.ID,
		Name:      h.Name,
		Building:  h.Building,
		Tone:      h.Tone,
		CreatedAt: timestamppb.New(h.CreatedAt),
		UpdatedAt: timestamppb.New(h.UpdatedAt),
	}
}

// HallBooking holds a hall on a date from TimeStart to TimeEnd. Bookings of
// one hall never overlap (enforced in storage, under a lock on the hall).
type HallBooking struct {
	ID int64 `gorm:"primaryKey;autoIncrement"`

	HallID    int64  `gorm:"not null;index:idx_hall_bookings_hall_date,priority:1"`
	Hall      *Hall  `gorm:"constraint:OnDelete:CASCADE"`
	Date      string `gorm:"size:10;not null;index:idx_hall_bookings_hall_date,priority:2"`
	TimeStart string `gorm:"size:5;not null"`
	TimeEnd   string `gorm:"size:5;not null"`
	Title     string `gorm:"size:255;not null"`

	Organizer string `gorm:"size:255;not null;default:''"`
	Contact   string `gorm:"size:255;not null;default:''"`
	// ConsentedAt is retained for compatibility with historical booking rows.
	ConsentedAt *time.Time
	Status string `gorm:"size:16;not null;default:'PENDING'"`
	ApplicantRole string `gorm:"size:64;not null;default:''"`
	ApplicantID string `gorm:"size:64;not null;default:'';index"`
	ReviewComment string `gorm:"type:text;not null;default:''"`
	ReviewedBy string `gorm:"size:255;not null;default:''"`
	ReviewedAt *time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (b *HallBooking) ToProto() *entity.HallBooking {
	return &entity.HallBooking{
		Id:        b.ID,
		HallId:    b.HallID,
		Date:      b.Date,
		TimeStart: b.TimeStart,
		TimeEnd:   b.TimeEnd,
		Title:     b.Title,
		Organizer: b.Organizer,
		Contact:   b.Contact,
		CreatedAt: timestamppb.New(b.CreatedAt),
		UpdatedAt: timestamppb.New(b.UpdatedAt),
		Status: hallStatusProto(b.Status),
		ApplicantRole: b.ApplicantRole,
		ReviewComment: b.ReviewComment,
		ReviewedBy: b.ReviewedBy,
		ReviewedAt: func() *timestamppb.Timestamp { if b.ReviewedAt == nil { return nil }; return timestamppb.New(*b.ReviewedAt) }(),
	}
}

func hallStatusProto(status string) enum.HallBookingStatus {
	switch status {
	case "APPROVED": return enum.HallBookingStatus_HALL_BOOKING_STATUS_APPROVED
	case "REJECTED": return enum.HallBookingStatus_HALL_BOOKING_STATUS_REJECTED
	case "CANCELLED": return enum.HallBookingStatus_HALL_BOOKING_STATUS_CANCELLED
	default: return enum.HallBookingStatus_HALL_BOOKING_STATUS_PENDING
	}
}

// ToPublicProto is the booking as anyone may see it: what and when, not who.
func (b *HallBooking) ToPublicProto() *entity.HallBooking {
	p := b.ToProto()
	p.Organizer = ""
	p.Contact = ""
	return p
}

// HallBookingFilter narrows the list; zero values mean "any". Dates are inclusive.
type HallBookingFilter struct {
	HallID   int64
	DateFrom string
	DateTo   string
	ApprovedOnly bool
	ApplicantID string
}

type HallBookingCreateParams struct {
	HallID    int64
	Date      string
	TimeStart string
	TimeEnd   string
	Title     string
	Organizer string
	Contact   string
	ApplicantRole string
	ApplicantID string
}

var hallClockRe = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d$`)

// NewHallBooking validates a new booking against today's date: halls are
// booked ahead, never in the past.
func NewHallBooking(params HallBookingCreateParams, now time.Time) (*HallBooking, error) {
	b := &HallBooking{
		HallID:    params.HallID,
		Date:      params.Date,
		TimeStart: params.TimeStart,
		TimeEnd:   params.TimeEnd,
		Title:     strings.TrimSpace(params.Title),
		Organizer: strings.TrimSpace(params.Organizer),
		Contact:   strings.TrimSpace(params.Contact),
		CreatedAt: now,
		UpdatedAt: now,
		Status: "PENDING",
		ApplicantRole: strings.TrimSpace(params.ApplicantRole),
		ApplicantID: strings.TrimSpace(params.ApplicantID),
	}

	if err := b.Validate(); err != nil {
		return nil, err
	}
	if b.Date < now.Format("2006-01-02") {
		return nil, hallBookingInvalid("нельзя забронировать зал на прошедшую дату")
	}
	return b, nil
}

func (b *HallBooking) Validate() error {
	if b.HallID == 0 {
		return hallBookingInvalid("выберите зал")
	}
	if _, err := time.Parse("2006-01-02", b.Date); err != nil {
		return hallBookingInvalid("дата должна быть в формате ГГГГ-ММ-ДД")
	}
	if !hallClockRe.MatchString(b.TimeStart) || !hallClockRe.MatchString(b.TimeEnd) {
		return hallBookingInvalid("время должно быть в формате ЧЧ:ММ")
	}
	// HH:MM strings compare in time order.
	if b.TimeEnd <= b.TimeStart {
		return hallBookingInvalid("время окончания должно быть позже начала")
	}
	if b.TimeStart < HallDayStart || b.TimeEnd > HallDayEnd {
		return hallBookingInvalid(fmt.Sprintf("зал можно забронировать с %s до %s", HallDayStart, HallDayEnd))
	}
	if b.Title == "" {
		return hallBookingInvalid("укажите, что проходит в зале")
	}
	if b.Organizer == "" {
		return hallBookingInvalid("укажите, кто бронирует зал")
	}
	if b.Contact == "" {
		return hallBookingInvalid("укажите телефон или e-mail для связи")
	}
	return nil
}

func hallBookingInvalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrHallBookingInvalid, msg)
}
