package models

import (
	"errors"
	"fesmu/contract/mdm/entity"
	"fesmu/contract/mdm/enum"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type Employee struct {
	ID         int64                       `gorm:"primaryKey;autoIncrement"`
	UserID     int64                       `gorm:"not null;index"`
	Department enum.UserEmployeeDepartment `gorm:"not null"`
	Status     enum.UserEmployeeStatus     `gorm:"not null;default:0"`
	Position   enum.UserEmployeePosition   `gorm:"not null;default:0"`
	SourceKey  *string                     `gorm:"size:120;uniqueIndex:idx_employees_source_key"`

	User User `gorm:"foreignKey:UserID"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (e *Employee) ToProto() *entity.Employee {
	pb := &entity.Employee{
		Id:         e.ID,
		UserId:     e.UserID,
		Department: e.Department,
		Status:     e.Status,
		Position:   e.Position,
		CreatedAt:  timestamppb.New(e.CreatedAt),
		UpdatedAt:  timestamppb.New(e.UpdatedAt),
	}
	if e.SourceKey != nil {
		pb.SourceKey = *e.SourceKey
	}
	return pb
}

type EmployeeCreateParams struct {
	UserID     int64
	Department enum.UserEmployeeDepartment
	Status     enum.UserEmployeeStatus
	Position   enum.UserEmployeePosition
	SourceKey  *string
}

func NewEmployee(params EmployeeCreateParams) (*Employee, error) {
	if params.UserID == 0 {
		return nil, errors.New("user_id is required")
	}

	now := time.Now()
	return &Employee{
		UserID:     params.UserID,
		Department: params.Department,
		Status:     params.Status,
		Position:   params.Position,
		SourceKey:  params.SourceKey,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}
