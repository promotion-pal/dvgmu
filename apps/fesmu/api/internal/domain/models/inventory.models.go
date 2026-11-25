package models

import (
	"errors"
	"time"

	entity "fesmu/contract/fesmu/entity/v1"
	enum "fesmu/contract/fesmu/enum/v1"

	"google.golang.org/protobuf/types/known/timestamppb"
)

var ErrInventoryNotFound = errors.New("inventory record not found")

type Inventory struct {
	ID int64 `gorm:"primaryKey;autoIncrement"`

	Title       string `gorm:"size:255;not null"`
	Description string `gorm:"size:1024"`

	InventoryNumber string `gorm:"size:64;not null;unique"`
	SerialNumber    string `gorm:"size:64"`

	PurchasePrice float64
	PurchaseDate  *time.Time

	InfrastructureID  int64
	ResponsibleUserID int64

	Status enum.InventoryStatus `gorm:"type:smallint"`
	Type   enum.InventoryType   `gorm:"type:smallint"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (i *Inventory) ToProto() *entity.Inventory {
	pb := &entity.Inventory{
		Id:                i.ID,
		Title:             i.Title,
		Description:       i.Description,
		InventoryNumber:   i.InventoryNumber,
		SerialNumber:      i.SerialNumber,
		PurchasePrice:     i.PurchasePrice,
		InfrastructureId:  i.InfrastructureID,
		ResponsibleUserId: i.ResponsibleUserID,
		Status:            i.Status,
		Type:              i.Type,
		CreatedAt:         timestamppb.New(i.CreatedAt),
		UpdatedAt:         timestamppb.New(i.UpdatedAt),
	}
	if i.PurchaseDate != nil {
		pb.PurchaseDate = timestamppb.New(*i.PurchaseDate)
	}
	return pb
}

type InventoryCreateParams struct {
	Title       string
	Description string

	InventoryNumber string
	SerialNumber    string

	PurchasePrice float64
	PurchaseDate  *time.Time

	InfrastructureID  int64
	ResponsibleUserID int64

	Status enum.InventoryStatus
	Type   enum.InventoryType
}

func NewInventory(params InventoryCreateParams) (*Inventory, error) {
	now := time.Now()
	i := &Inventory{
		Title:             params.Title,
		Description:       params.Description,
		InventoryNumber:   params.InventoryNumber,
		SerialNumber:      params.SerialNumber,
		PurchasePrice:     params.PurchasePrice,
		PurchaseDate:      params.PurchaseDate,
		InfrastructureID:  params.InfrastructureID,
		ResponsibleUserID: params.ResponsibleUserID,
		Status:            params.Status,
		Type:              params.Type,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	if err := i.Validate(); err != nil {
		return nil, err
	}
	return i, nil
}

func (i *Inventory) Validate() error {
	if i.Title == "" {
		return errors.New("title is required")
	}
	if i.InventoryNumber == "" {
		return errors.New("inventory_number is required")
	}
	return nil
}
