package models

import (
	"errors"
	"fesmu/contract/mdm/entity"
	"fesmu/contract/mdm/enum"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

var ErrInvalidRole = errors.New("invalid user role")

// UserRole — одна роль пользователя (строка user_roles). Набор ролей
// задаётся вручную через UserRolesSet, ни из students/employees не выводится.
type UserRole struct {
	UserID    int64         `gorm:"primaryKey"`
	Role      enum.UserRole `gorm:"primaryKey;type:smallint"`
	CreatedAt time.Time
}

func (UserRole) TableName() string { return "user_roles" }

// RoleList — роли пользователя по порядку значений enum.
func (u *User) RoleList() []enum.UserRole {
	out := make([]enum.UserRole, 0, len(u.Roles))
	for _, r := range u.Roles {
		out = append(out, r.Role)
	}
	slices.Sort(out)
	return out
}

// NormalizeRoles убирает дубли и сортирует; UNSPECIFIED и неизвестные
// значения — ErrInvalidRole. Пустой набор допустим (снять все роли).
func NormalizeRoles(roles []enum.UserRole) ([]enum.UserRole, error) {
	out := make([]enum.UserRole, 0, len(roles))
	for _, r := range roles {
		if r == enum.UserRole_USER_ROLE_UNSPECIFIED {
			return nil, ErrInvalidRole
		}
		if _, ok := enum.UserRole_name[int32(r)]; !ok {
			return nil, ErrInvalidRole
		}
		out = append(out, r)
	}
	slices.Sort(out)
	return slices.Compact(out), nil
}

// ADLink — связка пользователя MDM с учёткой AD (objectGUID).
type ADLink struct {
	UserID     int64
	ADObjectID string
}

var ErrInvalidPermission = errors.New("invalid permission: want section.action")

var permissionFormat = regexp.MustCompile(`^[a-z][a-z_]*\.[a-z][a-z_]*$`)

// UserPermission — право пользователя на отдельное действие (строка
// user_permissions), напр. "certificate.view".
type UserPermission struct {
	PermissionID int64  `gorm:"column:id;->"`
	UserID       int64  `gorm:"primaryKey"`
	Permission   string `gorm:"primaryKey;size:64"`
	CreatedAt    time.Time
}

func (UserPermission) TableName() string { return "user_permissions" }

func (u *User) PermissionList() []string {
	out := make([]string, 0, len(u.Permissions))
	for _, p := range u.Permissions {
		out = append(out, p.Permission)
	}
	slices.Sort(out)
	return out
}

func (u *User) PermissionGroupIDs() []int64 {
	out := make([]int64, 0, len(u.UserPermissionGroups))
	for _, g := range u.UserPermissionGroups {
		out = append(out, g.ID)
	}
	slices.Sort(out)
	return out
}

// PermissionIDs returns the stable database ids for the user's individual permissions.
func (u *User) PermissionIDs() []int64 {
	out := make([]int64, 0, len(u.Permissions))
	for _, p := range u.Permissions {
		if p.PermissionID > 0 {
			out = append(out, p.PermissionID)
		}
	}
	slices.Sort(out)
	return slices.Compact(out)
}

// DepartmentList — подразделения человека (без «не указано»).
func (u *User) DepartmentList() []enum.UserEmployeeDepartment {
	out := make([]enum.UserEmployeeDepartment, 0, len(u.Employees))
	for _, e := range u.Employees {
		out = append(out, e.Department)
	}
	return NormalizeDepartments(out)
}

// EffectivePermissions — итоговые права пользователя и назначенных ему групп.
func (u *User) EffectivePermissions() []string {
	out := u.PermissionList()
	for _, g := range u.UserPermissionGroups {
		out = append(out, g.PermissionList()...)
	}
	slices.Sort(out)
	return slices.Compact(out)
}

// NormalizeDepartments — без UNSPECIFIED и повторов, по возрастанию.
func NormalizeDepartments(deps []enum.UserEmployeeDepartment) []enum.UserEmployeeDepartment {
	out := make([]enum.UserEmployeeDepartment, 0, len(deps))
	for _, d := range deps {
		if d > 0 {
			out = append(out, d)
		}
	}
	slices.Sort(out)
	return slices.Compact(out)
}

// NormalizePermissions: регистр/пробелы, дубли, формат "раздел.действие".
func NormalizePermissions(perms []string) ([]string, error) {
	out := make([]string, 0, len(perms))
	for _, p := range perms {
		p = strings.ToLower(strings.TrimSpace(p))
		if len(p) > 64 || !permissionFormat.MatchString(p) {
			return nil, ErrInvalidPermission
		}
		out = append(out, p)
	}
	slices.Sort(out)
	return slices.Compact(out), nil
}

var (
	ErrUserPermissionGroupNotFound = errors.New("permission group not found")
	ErrUserPermissionGroupName     = errors.New("permission group name: 1–100 characters")
	ErrUserPermissionGroupExists   = errors.New("permission group with this name already exists")
)

// UserPermissionGroup — набор доступа: именованный набор прав, который выдают людям.
type UserPermissionGroup struct {
	ID          int64                           `gorm:"primaryKey;autoIncrement"`
	Name        string                          `gorm:"size:100;not null;unique"`
	Description string                          `gorm:"not null;default:''"`
	Permissions []UserPermissionGroupPermission `gorm:"foreignKey:GroupID"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (UserPermissionGroup) TableName() string { return "user_permission_groups" }

type UserPermissionGroupPermission struct {
	GroupID    int64  `gorm:"primaryKey"`
	Permission string `gorm:"primaryKey;size:64"`
}

func (UserPermissionGroupPermission) TableName() string { return "user_permission_group_permissions" }

// UserPermissionGroupAssignment — строка user_permission_group_users.
type UserPermissionGroupAssignment struct {
	UserID    int64 `gorm:"primaryKey"`
	GroupID   int64 `gorm:"primaryKey"`
	CreatedAt time.Time
}

func (UserPermissionGroupAssignment) TableName() string { return "user_permission_group_users" }

func (g *UserPermissionGroup) PermissionList() []string {
	out := make([]string, 0, len(g.Permissions))
	for _, p := range g.Permissions {
		out = append(out, p.Permission)
	}
	slices.Sort(out)
	return out
}

func (g *UserPermissionGroup) ToProto() *entity.UserPermissionGroup {
	return &entity.UserPermissionGroup{
		Id:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		Permissions: g.PermissionList(),
	}
}

// NormalizeUserPermissionGroupName — без лишних пробелов, 1–100 символов.
func NormalizeUserPermissionGroupName(name string) (string, error) {
	name = strings.Join(strings.Fields(name), " ")
	if name == "" || utf8.RuneCountInString(name) > 100 {
		return "", ErrUserPermissionGroupName
	}
	return name, nil
}

// NormalizeIDs — без нулей и повторов, по возрастанию.
func NormalizeIDs(ids []int64) []int64 {
	out := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id > 0 {
			out = append(out, id)
		}
	}
	slices.Sort(out)
	return slices.Compact(out)
}
