package models

import (
	"errors"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"dvgmu/api/contract/gen/go/entity"
	"dvgmu/api/contract/gen/go/enum"
)

var (
	ErrAccessGroupNotFound = errors.New("access group not found")
	ErrAccessGroupName     = errors.New("access group name: 1–100 characters")
	ErrAccessGroupExists   = errors.New("access group with this name already exists")
)

// AccessGroup — набор доступа: именованный набор прав, который выдают людям.
type AccessGroup struct {
	ID          int64                   `gorm:"primaryKey;autoIncrement"`
	Name        string                  `gorm:"size:100;not null;unique"`
	Description string                  `gorm:"not null;default:''"`
	Permissions []AccessGroupPermission `gorm:"foreignKey:GroupID"`
	// Departments — подразделения, всем сотрудникам которых доступ выдан сам.
	Departments []AccessGroupDepartment `gorm:"foreignKey:GroupID"`
	CreatedAt   time.Time
	UpdatedAt   time.Time

	// UserCount — сколько людей с этим набором (только для списка наборов).
	UserCount int64 `gorm:"->;-:migration"`
}

func (AccessGroup) TableName() string { return "access_groups" }

type AccessGroupPermission struct {
	GroupID    int64  `gorm:"primaryKey"`
	Permission string `gorm:"primaryKey;size:64"`
}

func (AccessGroupPermission) TableName() string { return "access_group_permissions" }

// AccessGroupDepartment — строка access_group_departments.
type AccessGroupDepartment struct {
	GroupID    int64                       `gorm:"primaryKey"`
	Department enum.UserEmployeeDepartment `gorm:"primaryKey"`
}

func (AccessGroupDepartment) TableName() string { return "access_group_departments" }

func (g *AccessGroup) DepartmentList() []enum.UserEmployeeDepartment {
	out := make([]enum.UserEmployeeDepartment, 0, len(g.Departments))
	for _, d := range g.Departments {
		out = append(out, d.Department)
	}
	slices.Sort(out)
	return out
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

// UserAccessGroup — строка user_access_groups (набор выдан человеку).
type UserAccessGroup struct {
	UserID    int64 `gorm:"primaryKey"`
	GroupID   int64 `gorm:"primaryKey"`
	CreatedAt time.Time
}

func (UserAccessGroup) TableName() string { return "user_access_groups" }

func (g *AccessGroup) PermissionList() []string {
	out := make([]string, 0, len(g.Permissions))
	for _, p := range g.Permissions {
		out = append(out, p.Permission)
	}
	slices.Sort(out)
	return out
}

func (g *AccessGroup) ToProto() *entity.AccessGroup {
	return &entity.AccessGroup{
		Id:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		Permissions: g.PermissionList(),
		UserCount:   g.UserCount,
		Departments: g.DepartmentList(),
	}
}

// NormalizeAccessGroupName — без лишних пробелов, 1–100 символов.
func NormalizeAccessGroupName(name string) (string, error) {
	name = strings.Join(strings.Fields(name), " ")
	if name == "" || utf8.RuneCountInString(name) > 100 {
		return "", ErrAccessGroupName
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
