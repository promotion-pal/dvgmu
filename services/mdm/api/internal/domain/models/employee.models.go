package models

import (
	"fesmu/contract/mdm/entity"
	"fesmu/contract/mdm/enum"
	"errors"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type Employee struct {
	ID     int64 `gorm:"primaryKey;autoIncrement"`
	UserID int64 `gorm:"not null;index;uniqueIndex:idx_employees_user_department"`

	Department enum.UserEmployeeDepartment `gorm:"not null;uniqueIndex:idx_employees_user_department"`

	User User `gorm:"foreignKey:UserID"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (e *Employee) ToProto() *entity.Employee {
	return &entity.Employee{
		Id:         e.ID,
		UserId:     e.UserID,
		Department: e.Department,
		CreatedAt:  timestamppb.New(e.CreatedAt),
		UpdatedAt:  timestamppb.New(e.UpdatedAt),
	}
}

type EmployeeCreateParams struct {
	UserID     int64
	Department enum.UserEmployeeDepartment
}

func NewEmployee(params EmployeeCreateParams) (*Employee, error) {
	if params.UserID == 0 {
		return nil, errors.New("user_id is required")
	}

	now := time.Now()
	return &Employee{
		UserID:     params.UserID,
		Department: params.Department,
		CreatedAt:  now,
		UpdatedAt:  now,
	}, nil
}
