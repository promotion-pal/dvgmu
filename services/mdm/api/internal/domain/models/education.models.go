package models

import (
	"fesmu/contract/mdm/entity"
	"fesmu/contract/mdm/enum"
	"errors"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

var ErrEducationNotFound = errors.New("education record not found")

type Education struct {
	ID     int64 `gorm:"primaryKey;autoIncrement"`
	UserID int64 `gorm:"not null;index"`

	Type   enum.EducationType   `gorm:"not null"`
	Status enum.EducationStatus `gorm:"not null"`

	Series             string `gorm:"size:16"`
	Number             string `gorm:"size:16"`
	RegistrationNumber string `gorm:"size:64"`
	IssueDate          time.Time

	InstitutionInn         string `gorm:"size:16"`
	InstitutionName        string `gorm:"size:255"`
	InstitutionCity        string `gorm:"size:255"`
	InstitutionRegion      string `gorm:"size:255"`
	InstitutionCountryCode string `gorm:"size:8"`

	SpecialtyCode string `gorm:"size:32"`
	SpecialtyName string `gorm:"size:255"`
	Qualification string `gorm:"size:255"`
	Honors        string `gorm:"size:64"`

	SupplementSeries string `gorm:"size:16"`
	SupplementNumber string `gorm:"size:16"`

	IsOriginal        bool `gorm:"not null;default:false"`
	IsVerifiedViaFrdo bool `gorm:"not null;default:false"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (e *Education) ToProto() *entity.Education {
	return &entity.Education{
		Id:                     e.ID,
		Type:                   e.Type,
		Status:                 e.Status,
		Series:                 e.Series,
		Number:                 e.Number,
		RegistrationNumber:     e.RegistrationNumber,
		IssueDate:              timestamppb.New(e.IssueDate),
		InstitutionInn:         e.InstitutionInn,
		InstitutionName:        e.InstitutionName,
		InstitutionCity:        e.InstitutionCity,
		InstitutionRegion:      e.InstitutionRegion,
		InstitutionCountryCode: e.InstitutionCountryCode,
		SpecialtyCode:          e.SpecialtyCode,
		SpecialtyName:          e.SpecialtyName,
		Qualification:          e.Qualification,
		Honors:                 e.Honors,
		SupplementSeries:       e.SupplementSeries,
		SupplementNumber:       e.SupplementNumber,
		IsOriginal:             e.IsOriginal,
		IsVerifiedViaFrdo:      e.IsVerifiedViaFrdo,
		CreatedAt:              timestamppb.New(e.CreatedAt),
		UpdatedAt:              timestamppb.New(e.UpdatedAt),
	}
}

type EducationCreateParams struct {
	UserID int64

	Type   enum.EducationType
	Status enum.EducationStatus

	Series             string
	Number             string
	RegistrationNumber string
	IssueDate          time.Time

	InstitutionInn         string
	InstitutionName        string
	InstitutionCity        string
	InstitutionRegion      string
	InstitutionCountryCode string

	SpecialtyCode string
	SpecialtyName string
	Qualification string
	Honors        string

	SupplementSeries string
	SupplementNumber string

	IsOriginal        bool
	IsVerifiedViaFrdo bool
}

func NewEducation(params EducationCreateParams) (*Education, error) {
	if params.UserID == 0 {
		return nil, errors.New("user_id is required")
	}

	now := time.Now()
	return &Education{
		UserID:                 params.UserID,
		Type:                   params.Type,
		Status:                 params.Status,
		Series:                 params.Series,
		Number:                 params.Number,
		RegistrationNumber:     params.RegistrationNumber,
		IssueDate:              params.IssueDate,
		InstitutionInn:         params.InstitutionInn,
		InstitutionName:        params.InstitutionName,
		InstitutionCity:        params.InstitutionCity,
		InstitutionRegion:      params.InstitutionRegion,
		InstitutionCountryCode: params.InstitutionCountryCode,
		SpecialtyCode:          params.SpecialtyCode,
		SpecialtyName:          params.SpecialtyName,
		Qualification:          params.Qualification,
		Honors:                 params.Honors,
		SupplementSeries:       params.SupplementSeries,
		SupplementNumber:       params.SupplementNumber,
		IsOriginal:             params.IsOriginal,
		IsVerifiedViaFrdo:      params.IsVerifiedViaFrdo,
		CreatedAt:              now,
		UpdatedAt:              now,
	}, nil
}
