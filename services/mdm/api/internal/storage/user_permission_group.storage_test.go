package storage

import (
	"context"
	"errors"
	"slices"
	"testing"

	"dvgmu/api/internal/domain/models"
	"fesmu/contract/mdm/enum"
)

func TestUserPermissionGroups(t *testing.T) {
	db := testDB(t)
	t.Cleanup(func() { db.Exec("TRUNCATE user_permission_groups CASCADE") })
	users := UserStorageNew(db)
	s := UserPermissionGroupStorageNew(db)
	ctx := context.Background()

	user := &models.User{FirstName: "Анна", LastName: "Секретарёва", Email: "sekretareva_a@fesmu.ru", Status: enum.UserStatus_USER_STATUS_ACTIVE}
	userID, err := users.UserCreate(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if err := users.UserPermissionsSet(ctx, userID, []string{"schedule.edit"}); err != nil {
		t.Fatal(err)
	}

	dean := &models.UserPermissionGroup{Name: "Деканат"}
	deanID, err := s.UserPermissionGroupSave(ctx, dean, []string{"certificate.issue", "certificate.view"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.UserPermissionGroupSave(ctx, &models.UserPermissionGroup{Name: "деканат"}, nil); !errors.Is(err, models.ErrUserPermissionGroupExists) {
		t.Fatalf("duplicate name: got %v", err)
	}
	if err := s.UserPermissionGroupsSet(ctx, userID, []int64{deanID, deanID + 1000}); !errors.Is(err, models.ErrUserPermissionGroupNotFound) {
		t.Fatalf("unknown group: got %v", err)
	}
	if err := s.UserPermissionGroupsSet(ctx, userID, []int64{deanID}); err != nil {
		t.Fatal(err)
	}

	effective := func() []string {
		u, err := users.UserByUUID(ctx, user.UUID)
		if err != nil {
			t.Fatal(err)
		}
		return u.EffectivePermissions()
	}
	if got, want := effective(), []string{"certificate.issue", "certificate.view", "schedule.edit"}; !slices.Equal(got, want) {
		t.Fatalf("effective = %v, want %v", got, want)
	}

	// Правка набора сразу действует у всех, кому он выдан.
	if _, err := s.UserPermissionGroupSave(ctx, &models.UserPermissionGroup{ID: deanID, Name: "Деканат"}, []string{"certificate.view"}); err != nil {
		t.Fatal(err)
	}
	if got, want := effective(), []string{"certificate.view", "schedule.edit"}; !slices.Equal(got, want) {
		t.Fatalf("after edit effective = %v, want %v", got, want)
	}

	g, err := s.UserPermissionGroupByID(ctx, deanID)
	if err != nil || !slices.Equal(g.PermissionList(), []string{"certificate.view"}) {
		t.Fatalf("group = %+v, %v", g, err)
	}

	// Удалённый набор снимается со всех.
	if err := s.UserPermissionGroupDelete(ctx, deanID); err != nil {
		t.Fatal(err)
	}
	if got, want := effective(), []string{"schedule.edit"}; !slices.Equal(got, want) {
		t.Fatalf("after delete effective = %v, want %v", got, want)
	}
}

func TestDepartmentsDoNotGrantPermissionGroups(t *testing.T) {
	db := testDB(t)
	t.Cleanup(func() { db.Exec("TRUNCATE user_permission_groups CASCADE") })
	users := UserStorageNew(db)
	employees := EmployeeStorageNew(db)
	s := UserPermissionGroupStorageNew(db)
	ctx := context.Background()

	user := &models.User{FirstName: "Пётр", LastName: "Электриков", Email: "elektrikov_p@fesmu.ru", Status: enum.UserStatus_USER_STATUS_ACTIVE}
	userID, err := users.UserCreate(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	it := enum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_IT
	if _, err := s.UserPermissionGroupSave(ctx, &models.UserPermissionGroup{Name: "ИТ-отдел"}, []string{"inventory.post"}); err != nil {
		t.Fatal(err)
	}

	effective := func() ([]string, []enum.UserEmployeeDepartment) {
		u, err := users.UserByUUID(ctx, user.UUID)
		if err != nil {
			t.Fatal(err)
		}
		return u.EffectivePermissions(), u.DepartmentList()
	}
	// Назначение в подразделение не выдаёт права группы автоматически.
	if err := employees.EmployeeDepartmentsSet(ctx, userID, []enum.UserEmployeeDepartment{it}); err != nil {
		t.Fatal(err)
	}
	if got, deps := effective(); len(got) != 0 || !slices.Equal(deps, []enum.UserEmployeeDepartment{it}) {
		t.Fatalf("in department: perms %v deps %v", got, deps)
	}
}
