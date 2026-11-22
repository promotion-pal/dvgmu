package models

import (
	"errors"
	"net/mail"
	"sort"
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
	ErrInvalidRole       = errors.New("invalid user role")
)

type User struct {
	ID          int64           `gorm:"primaryKey;autoIncrement"`
	UUID        string          `gorm:"type:uuid;not null;uniqueIndex;default:gen_random_uuid()"`
	ADObjectID  *string         `gorm:"column:ad_object_id;type:uuid;uniqueIndex"`
	FirstName   string          `gorm:"size:255;not null"`
	LastName    string          `gorm:"size:255;not null"`
	Patronymic  string          `gorm:"size:255;not null;default:''"`
	Email       string          `gorm:"size:255;not null;default:''"`
	Phone       *string         `gorm:"size:32"`
	Status      enum.UserStatus `gorm:"type:smallint;not null;default:1"`
	Birthday    *time.Time      `gorm:"type:timestamptz"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Roles       []UserRole             `gorm:"foreignKey:UserID"`
	Permissions []UserPermissionRecord `gorm:"foreignKey:UserID"`
}

func (User) TableName() string { return "users" }

type UserRole struct {
	UserID int64         `gorm:"primaryKey;column:user_id"`
	Role   enum.UserRole `gorm:"primaryKey;type:smallint;column:role"`
}

func (UserRole) TableName() string { return "user_roles" }

type UserPermissionRecord struct {
	UserID     int64               `gorm:"primaryKey;column:user_id"`
	Permission enum.UserPermission `gorm:"primaryKey;type:smallint;column:permission"`
}

func (UserPermissionRecord) TableName() string { return "user_permissions" }

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
		Roles:      make([]enum.UserRole, 0, len(u.Roles)),
		Permission: &entity.UserPermission{UserUuid: u.UUID, Permissions: u.EffectivePermissions()},
	}
	for _, role := range u.Roles {
		user.Roles = append(user.Roles, role.Role)
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

func (u *User) EffectivePermissions() []enum.UserPermission {
	for _, role := range u.Roles {
		if role.Role == enum.UserRole_USER_ROLE_ADMIN {
			permissions := make([]enum.UserPermission, 0, len(enum.UserPermission_name)-1)
			for value := range enum.UserPermission_name {
				permission := enum.UserPermission(value)
				if permission != enum.UserPermission_USER_PERMISSION_UNSPECIFIED {
					permissions = append(permissions, permission)
				}
			}
			sort.Slice(permissions, func(i, j int) bool { return permissions[i] < permissions[j] })
			return permissions
		}
	}

	permissions := make([]enum.UserPermission, 0, len(u.Permissions))
	for _, permission := range u.Permissions {
		permissions = append(permissions, permission.Permission)
	}
	return permissions
}

func NormalizeRoles(roles []enum.UserRole) ([]enum.UserRole, error) {
	seen := make(map[enum.UserRole]struct{}, len(roles))
	normalized := make([]enum.UserRole, 0, len(roles))
	for _, role := range roles {
		if role != enum.UserRole_USER_ROLE_STUDENT && role != enum.UserRole_USER_ROLE_EMPLOYEE && role != enum.UserRole_USER_ROLE_ADMIN {
			return nil, ErrInvalidRole
		}
		if _, ok := seen[role]; ok {
			continue
		}
		seen[role] = struct{}{}
		normalized = append(normalized, role)
	}
	return normalized, nil
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
