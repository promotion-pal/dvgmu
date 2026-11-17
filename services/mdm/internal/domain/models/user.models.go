package models

import (
	"errors"
	"net/mail"
	"strings"
	"time"

	entity "fesmu/contract/mdm/entity"
	enum "fesmu/contract/mdm/enum"
	"google.golang.org/protobuf/types/known/timestamppb"
)

var (
	ErrUserNotFound      = errors.New("user not found")
	ErrUserAlreadyExists = errors.New("user already exists")
	ErrInvalidUser       = errors.New("invalid user")
)

type User struct {
	ID         int64           `gorm:"primaryKey;autoIncrement"`
	UUID       string          `gorm:"type:uuid;not null;uniqueIndex;default:gen_random_uuid()"`
	ADObjectID *string         `gorm:"column:ad_object_id;type:uuid;uniqueIndex"`
	FirstName  string          `gorm:"size:255;not null"`
	LastName   string          `gorm:"size:255;not null"`
	Patronymic string          `gorm:"size:255;not null;default:''"`
	Email      string          `gorm:"size:255;not null;default:''"`
	Phone      *string         `gorm:"size:32"`
	Status     enum.UserStatus `gorm:"type:smallint;not null;default:1"`
	Birthday   *time.Time      `gorm:"type:timestamptz"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (User) TableName() string { return "users" }

func (u *User) ToProto() *entity.User {
	user := &entity.User{
		Id:         u.ID,
		Uuid:       u.UUID,
		AdObjectId: u.ADObjectID,
		FirstName:  u.FirstName,
		LastName:   u.LastName,
		Email:      u.Email,
		Status:     u.Status,
		CreatedAt:  timestamppb.New(u.CreatedAt),
		UpdatedAt:  timestamppb.New(u.UpdatedAt),
	}
	if u.Patronymic != "" {
		user.Patronymic = &u.Patronymic
	}
	if u.Phone != nil {
		user.Phone = u.Phone
	}
	if u.Birthday != nil {
		user.Birthday = timestamppb.New(*u.Birthday)
	}
	return user
}

type UserCreateParams struct {
	FirstName  string
	LastName   string
	Patronymic string
	Email      string
	Phone      *string
	Birthday   *time.Time
}

func NewUser(params UserCreateParams) (*User, error) {
	user := &User{
		FirstName:  strings.TrimSpace(params.FirstName),
		LastName:   strings.TrimSpace(params.LastName),
		Patronymic: strings.TrimSpace(params.Patronymic),
		Email:      strings.ToLower(strings.TrimSpace(params.Email)),
		Phone:      normalizeOptionalString(params.Phone),
		Birthday:   params.Birthday,
		Status:     enum.UserStatus_USER_STATUS_ACTIVE,
	}
	if err := user.Validate(); err != nil {
		return nil, err
	}
	return user, nil
}

func (u *User) Validate() error {
	if u.FirstName == "" || u.LastName == "" {
		return ErrInvalidUser
	}
	if u.Email != "" {
		address, err := mail.ParseAddress(u.Email)
		if err != nil || address.Address != u.Email {
			return ErrInvalidUser
		}
	}
	if u.Status != enum.UserStatus_USER_STATUS_ACTIVE && u.Status != enum.UserStatus_USER_STATUS_INACTIVE {
		return ErrInvalidUser
	}
	return nil
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
