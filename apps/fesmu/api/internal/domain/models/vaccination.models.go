package models

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "dvgmu/api/contract/gen/go/entity/v1"
)

var (
	ErrVaccinationDayNotFound     = errors.New("vaccination day not found")
	ErrVaccinationSlotNotFound    = errors.New("vaccination slot not found")
	ErrVaccinationSignupNotFound  = errors.New("vaccination signup not found")
	ErrVaccinationSlotFull        = errors.New("в этом времени не осталось мест — выберите другое")
	ErrVaccinationAlreadySignedUp = errors.New("вы уже записаны на этот день")
	ErrVaccinationInvalid         = errors.New("invalid vaccination data")
)

var DefaultVaccinationSlots = []VaccinationSlot{
	{TimeStart: "10:00", TimeEnd: "10:30", Capacity: 12},
	{TimeStart: "10:30", TimeEnd: "11:00", Capacity: 12},
	{TimeStart: "11:00", TimeEnd: "11:30", Capacity: 12},
	{TimeStart: "11:30", TimeEnd: "12:00", Capacity: 12},
}

type VaccinationDay struct {
	ID    int64             `gorm:"primaryKey;autoIncrement"`
	Date  string            `gorm:"size:10;not null;index"`
	Title string            `gorm:"size:255;not null"`
	Place string            `gorm:"size:255;not null;default:''"`
	Note  string            `gorm:"size:1024;not null;default:''"`
	Slots []VaccinationSlot `gorm:"foreignKey:DayID;constraint:OnDelete:CASCADE"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

type VaccinationSlot struct {
	ID        int64               `gorm:"primaryKey;autoIncrement"`
	DayID     int64               `gorm:"not null;index"`
	TimeStart string              `gorm:"size:5;not null"`
	TimeEnd   string              `gorm:"size:5;not null"`
	Capacity  int32               `gorm:"not null"`
	Signups   []VaccinationSignup `gorm:"foreignKey:SlotID;constraint:OnDelete:CASCADE"`
}

type VaccinationSignup struct {
	ID          int64           `gorm:"primaryKey;autoIncrement"`
	DayID       int64           `gorm:"not null;uniqueIndex:idx_vaccination_signups_day_name,priority:1"`
	Day         *VaccinationDay `gorm:"foreignKey:DayID;constraint:OnDelete:CASCADE"`
	SlotID      int64           `gorm:"not null;index"`
	FullName    string          `gorm:"size:255;not null"`
	NameKey     string          `gorm:"size:255;not null;uniqueIndex:idx_vaccination_signups_day_name,priority:2"`
	ConsentedAt time.Time

	CreatedAt time.Time
}

func (d *VaccinationDay) ToProto() *entity.VaccinationDay {
	out := &entity.VaccinationDay{
		Id:        d.ID,
		Date:      d.Date,
		Title:     d.Title,
		Place:     d.Place,
		Note:      d.Note,
		CreatedAt: timestamppb.New(d.CreatedAt),
	}
	for _, slot := range d.Slots {
		s := &entity.VaccinationSlot{Id: slot.ID, TimeStart: slot.TimeStart, TimeEnd: slot.TimeEnd, Capacity: slot.Capacity}
		for _, signup := range slot.Signups {
			s.Signups = append(s.Signups, &entity.VaccinationSignup{
				Id:        signup.ID,
				FullName:  signup.FullName,
				CreatedAt: timestamppb.New(signup.CreatedAt),
			})
		}
		out.Slots = append(out.Slots, s)
	}
	return out
}

type VaccinationDayParams struct {
	Date  string
	Title string
	Place string
	Note  string
}

func NewVaccinationDay(params VaccinationDayParams, now time.Time) (*VaccinationDay, error) {
	d := &VaccinationDay{
		Date:      params.Date,
		Title:     strings.TrimSpace(params.Title),
		Place:     strings.TrimSpace(params.Place),
		Note:      strings.TrimSpace(params.Note),
		CreatedAt: now,
		UpdatedAt: now,
	}
	if _, err := time.Parse("2006-01-02", d.Date); err != nil {
		return nil, vaccinationInvalid("дата должна быть в формате ГГГГ-ММ-ДД")
	}
	if d.Title == "" {
		return nil, vaccinationInvalid("укажите название, например «Вакцинация против гриппа»")
	}
	d.Slots = append([]VaccinationSlot(nil), DefaultVaccinationSlots...)
	return d, nil
}

func NewVaccinationSignup(slotID int64, fullName string, consent bool, now time.Time) (*VaccinationSignup, error) {
	name := strings.Join(strings.Fields(fullName), " ")
	if slotID == 0 {
		return nil, vaccinationInvalid("выберите время")
	}
	if utf8.RuneCountInString(name) < 5 || len(strings.Fields(name)) < 2 {
		return nil, vaccinationInvalid("укажите фамилию, имя и отчество")
	}
	if utf8.RuneCountInString(name) > 255 {
		return nil, vaccinationInvalid("ФИО слишком длинное")
	}
	if !consent {
		return nil, vaccinationInvalid("нужно согласие на обработку и публикацию ФИО")
	}
	return &VaccinationSignup{
		SlotID:      slotID,
		FullName:    name,
		NameKey:     VaccinationNameKey(name),
		ConsentedAt: now,
		CreatedAt:   now,
	}, nil
}

func VaccinationNameKey(name string) string {
	return strings.ReplaceAll(strings.ToLower(strings.Join(strings.Fields(name), " ")), "ё", "е")
}

func vaccinationInvalid(msg string) error {
	return fmt.Errorf("%w: %s", ErrVaccinationInvalid, msg)
}
