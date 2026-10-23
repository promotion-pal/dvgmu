package models

import (
	"dvgmu/api/contract/gen/go/entity"
	"dvgmu/api/contract/gen/go/enum"
	"errors"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

var (
	ErrUserNotFound      = errors.New("user record not found")
	ErrUserAlreadyExists = errors.New("user with this email already exists")
	ErrInvalidPhone      = errors.New("invalid phone number")
	ErrPositionTooLong   = errors.New("должность длиннее 255 символов")
)

type User struct {
	ID int64 `gorm:"primaryKey;autoIncrement"`

	FirstName  string `gorm:"size:255;not null"`
	LastName   string `gorm:"size:255;not null"`
	Patronymic string `gorm:"size:255"`

	Email    string          `gorm:"size:255;not null;unique"`
	Birthday *time.Time      `gorm:"type:timestamptz"`
	Phone    *string         `gorm:"size:32"`
	Status   enum.UserStatus `gorm:"not null;default:1"`
	// Position — должность сотрудника («Начальник отдела»); пусто, пока не задана.
	Position string `gorm:"size:255;not null;default:''"`

	UUID        string           `gorm:"column:uuid;type:uuid;not null;unique;default:gen_random_uuid()"`
	Username    *string          `gorm:"size:50"`
	ADObjectID  *string          `gorm:"column:ad_object_id;type:uuid;unique"`
	Roles       []UserRole       `gorm:"foreignKey:UserID"`
	Permissions []UserPermission `gorm:"foreignKey:UserID"`
	// AccessGroups — выданные наборы доступа (с их правами).
	AccessGroups []AccessGroup `gorm:"many2many:user_access_groups;joinForeignKey:UserID;joinReferences:GroupID"`
	// Employees — все записи сотрудника (по одной на подразделение).
	Employees []Employee `gorm:"foreignKey:UserID"`
	// DepartmentGroups — доступы, привязанные к подразделениям человека
	// (заполняет storage, в таблице не хранится).
	DepartmentGroups []AccessGroup `gorm:"-"`

	Passport   *Passport   `gorm:"foreignKey:UserID"`
	Educations []Education `gorm:"foreignKey:UserID"`
	Military   *Military   `gorm:"foreignKey:UserID"`
	Student    *Student    `gorm:"foreignKey:UserID"`
	Employee   *Employee   `gorm:"foreignKey:UserID"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (u *User) ToProto() *entity.User {
	pb := &entity.User{
		Id:        u.ID,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Email:     u.Email,
		Status:    u.Status,
		Position:  u.Position,
		CreatedAt: timestamppb.New(u.CreatedAt),
		UpdatedAt: timestamppb.New(u.UpdatedAt),

		Uuid:        u.UUID,
		Username:    u.Username,
		AdObjectId:  u.ADObjectID,
		Roles:       u.RoleList(),
		Permissions: u.PermissionList(),

		AccessGroupIds:           u.AccessGroupIDs(),
		EffectivePermissions:     u.EffectivePermissions(),
		Departments:              u.DepartmentList(),
		DepartmentAccessGroupIds: u.DepartmentGroupIDs(),
	}
	if u.Patronymic != "" {
		pb.Patronymic = &u.Patronymic
	}
	if u.Phone != nil {
		pb.Phone = u.Phone
	}
	if u.Birthday != nil {
		pb.Birthday = timestamppb.New(*u.Birthday)
	}
	return pb
}

func (u *User) ToFullProto() *entity.UserFull {
	full := &entity.UserFull{
		User: u.ToProto(),
	}
	if u.Passport != nil {
		full.Passport = u.Passport.ToProto()
	}
	for _, edu := range u.Educations {
		full.Educations = append(full.Educations, edu.ToProto())
	}
	if u.Military != nil {
		full.Military = u.Military.ToProto()
	}
	if u.Student != nil {
		full.Student = u.Student.ToProto()
	}
	if u.Employee != nil {
		full.Employee = u.Employee.ToProto()
	}
	return full
}

type UserCreateResult struct {
	ID                int64
	Email             string
	TemporaryPassword string
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
	if params.FirstName == "" {
		return nil, errors.New("first_name is required")
	}
	if params.LastName == "" {
		return nil, errors.New("last_name is required")
	}

	phone, err := NormalizePhonePtr(params.Phone)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	u := &User{
		FirstName:  params.FirstName,
		LastName:   params.LastName,
		Patronymic: params.Patronymic,
		Email:      params.Email,
		Phone:      phone,
		Birthday:   params.Birthday,
		Status:     enum.UserStatus_USER_STATUS_ACTIVE,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := u.Validate(); err != nil {
		return nil, err
	}
	return u, nil
}

func (u *User) Validate() error {
	if u.FirstName == "" {
		return errors.New("first_name is required")
	}
	if u.LastName == "" {
		return errors.New("last_name is required")
	}
	return nil
}

// NormalizePhone приводит телефон к единому виду, в котором он хранится:
//   - российские номера — "+7XXXXXXXXXX" (из "8 (914) 313-30-75",
//     "+7(906)5391570", "79244172079", "9143133075" и т.п.);
//   - иностранные — "+" и цифры с кодом страны ("+992...").
//
// Пустая строка — не ошибка (телефон не задан). Всё, что на телефон не
// похоже, возвращает ErrInvalidPhone.
func NormalizePhone(raw string) (string, error) {
	if strings.TrimSpace(raw) == "" {
		return "", nil
	}
	digits := onlyDigits(raw)

	switch {
	case len(digits) == 11 && (digits[0] == '7' || digits[0] == '8'):
		return "+7" + digits[1:], nil
	case len(digits) == 10:
		return "+7" + digits, nil
	case len(digits) >= 11 && len(digits) <= 15:
		return "+" + digits, nil
	default:
		return "", ErrInvalidPhone
	}
}

// NormalizePhonePtr — то же для необязательного поля: nil и пустая строка
// дают nil.
func NormalizePhonePtr(raw *string) (*string, error) {
	if raw == nil {
		return nil, nil
	}
	phone, err := NormalizePhone(*raw)
	if err != nil {
		return nil, err
	}
	if phone == "" {
		return nil, nil
	}
	return &phone, nil
}
