package models

import (
	"errors"
	"regexp"
	"slices"
	"strings"
	"time"

	"fesmu/contract/mdm/enum"
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
	UserID     int64  `gorm:"primaryKey"`
	Permission string `gorm:"primaryKey;size:64"`
	CreatedAt  time.Time
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

func (u *User) AccessGroupIDs() []int64 {
	out := make([]int64, 0, len(u.AccessGroups))
	for _, g := range u.AccessGroups {
		out = append(out, g.ID)
	}
	slices.Sort(out)
	return out
}

// DepartmentList — подразделения человека (без «не указано»).
func (u *User) DepartmentList() []enum.UserEmployeeDepartment {
	out := make([]enum.UserEmployeeDepartment, 0, len(u.Employees))
	for _, e := range u.Employees {
		out = append(out, e.Department)
	}
	return NormalizeDepartments(out)
}

func (u *User) DepartmentGroupIDs() []int64 {
	out := make([]int64, 0, len(u.DepartmentGroups))
	for _, g := range u.DepartmentGroups {
		out = append(out, g.ID)
	}
	slices.Sort(out)
	return slices.Compact(out)
}

// EffectivePermissions — итоговые права: свои, выданных доступов и доступов
// подразделений человека.
func (u *User) EffectivePermissions() []string {
	out := u.PermissionList()
	for _, g := range u.AccessGroups {
		out = append(out, g.PermissionList()...)
	}
	for _, g := range u.DepartmentGroups {
		out = append(out, g.PermissionList()...)
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
