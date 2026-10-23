package models

import (
	"dvgmu/api/contract/gen/go/entity"
	"dvgmu/api/contract/gen/go/enum"
	"errors"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type Military struct {
	ID     int64 `gorm:"primaryKey;autoIncrement"`
	UserID int64 `gorm:"not null;index"`

	Commissariat string `gorm:"size:255"`
	VusCode      string `gorm:"size:16"`

	Rank     enum.MilitaryRank     `gorm:"not null"`
	Document enum.MilitaryDocument `gorm:"not null"`
	Validity enum.MilitaryValidity `gorm:"not null"`

	HasDeferment       bool `gorm:"not null;default:false"`
	DefermentExpiresAt time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (m *Military) ToProto() *entity.Military {
	return &entity.Military{
		Id:                 m.ID,
		UserId:             m.UserID,
		Commissariat:       m.Commissariat,
		VusCode:            m.VusCode,
		Rank:               m.Rank,
		Document:           m.Document,
		Validity:           m.Validity,
		HasDeferment:       m.HasDeferment,
		DefermentExpiresAt: timestamppb.New(m.DefermentExpiresAt),
		CreatedAt:          timestamppb.New(m.CreatedAt),
		UpdatedAt:          timestamppb.New(m.UpdatedAt),
	}
}

type MilitaryCreateParams struct {
	UserID int64

	Commissariat string
	VusCode      string

	Rank     enum.MilitaryRank
	Document enum.MilitaryDocument
	Validity enum.MilitaryValidity

	HasDeferment       bool
	DefermentExpiresAt time.Time
}

func NewMilitary(params MilitaryCreateParams) (*Military, error) {
	if params.UserID == 0 {
		return nil, errors.New("user_id is required")
	}

	now := time.Now()
	return &Military{
		UserID:             params.UserID,
		Commissariat:       params.Commissariat,
		VusCode:            params.VusCode,
		Rank:               params.Rank,
		Document:           params.Document,
		Validity:           params.Validity,
		HasDeferment:       params.HasDeferment,
		DefermentExpiresAt: params.DefermentExpiresAt,
		CreatedAt:          now,
		UpdatedAt:          now,
	}, nil
}
