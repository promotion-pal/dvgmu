package models

import (
	"errors"
	"time"

	entity "dvgmu/api/contract/gen/go/entity/v1"
	enum "dvgmu/api/contract/gen/go/enum/v1"

	"google.golang.org/protobuf/types/known/timestamppb"
)

var ErrInfrastructureNotFound = errors.New("infrastructure record not found")

type Infrastructure struct {
	ID int64 `gorm:"primaryKey;autoIncrement"`

	Title       string `gorm:"size:255;not null"`
	Description string `gorm:"size:1024"`

	Floor int32
	Room  int32

	Location enum.LocationCommonType `gorm:"type:smallint"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (i *Infrastructure) ToProto() *entity.Infrastructure {
	return &entity.Infrastructure{
		Id:          i.ID,
		Title:       i.Title,
		Description: i.Description,
		Floor:       i.Floor,
		Room:        i.Room,
		Location:    i.Location,
		CreatedAt:   timestamppb.New(i.CreatedAt),
		UpdatedAt:   timestamppb.New(i.UpdatedAt),
	}
}

type InfrastructureCreateParams struct {
	Title       string
	Description string

	Floor int32
	Room  int32

	Location enum.LocationCommonType
}

func NewInfrastructure(params InfrastructureCreateParams) (*Infrastructure, error) {
	now := time.Now()
	i := &Infrastructure{
		Title:       params.Title,
		Description: params.Description,
		Floor:       params.Floor,
		Room:        params.Room,
		Location:    params.Location,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := i.Validate(); err != nil {
		return nil, err
	}
	return i, nil
}

func (i *Infrastructure) Validate() error {
	if i.Title == "" {
		return errors.New("title is required")
	}
	return nil
}
