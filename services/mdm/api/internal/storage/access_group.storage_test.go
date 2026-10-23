package storage

import (
	"context"
	"errors"
	"slices"
	"testing"

	"fesmu/contract/mdm/enum"
	"dvgmu/api/internal/domain/models"
)

func TestAccessGroups(t *testing.T) {
	db := testDB(t)
	t.Cleanup(func() { db.Exec("TRUNCATE access_groups CASCADE") })
	users := UserStorageNew(db)
	s := AccessGroupStorageNew(db)
	ctx := context.Background()

	user := &models.User{FirstName: "Анна", LastName: "Секретарёва", Email: "sekretareva_a@fesmu.ru", Status: enum.UserStatus_USER_STATUS_ACTIVE}
	userID, err := users.UserCreate(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if err := users.UserPermissionsSet(ctx, userID, []string{"schedule.edit"}); err != nil {
		t.Fatal(err)
	}

	dean := &models.AccessGroup{Name: "Деканат"}
	deanID, err := s.AccessGroupSave(ctx, dean, []string{"certificate.issue", "certificate.view"}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.AccessGroupSave(ctx, &models.AccessGroup{Name: "деканат"}, nil, nil); !errors.Is(err, models.ErrAccessGroupExists) {
		t.Fatalf("duplicate name: got %v", err)
	}
	if err := s.UserAccessGroupsSet(ctx, userID, []int64{deanID, deanID + 1000}); !errors.Is(err, models.ErrAccessGroupNotFound) {
		t.Fatalf("unknown group: got %v", err)
	}
	if err := s.UserAccessGroupsSet(ctx, userID, []int64{deanID}); err != nil {
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
	if _, err := s.AccessGroupSave(ctx, &models.AccessGroup{ID: deanID, Name: "Деканат"}, []string{"certificate.view"}, nil); err != nil {
		t.Fatal(err)
	}
	if got, want := effective(), []string{"certificate.view", "schedule.edit"}; !slices.Equal(got, want) {
		t.Fatalf("after edit effective = %v, want %v", got, want)
	}

	g, err := s.AccessGroupByID(ctx, deanID)
	if err != nil || g.UserCount != 1 || !slices.Equal(g.PermissionList(), []string{"certificate.view"}) {
		t.Fatalf("group = %+v, %v", g, err)
	}

	// Удалённый набор снимается со всех.
	if err := s.AccessGroupDelete(ctx, deanID); err != nil {
		t.Fatal(err)
	}
	if got, want := effective(), []string{"schedule.edit"}; !slices.Equal(got, want) {
		t.Fatalf("after delete effective = %v, want %v", got, want)
	}
}

func TestDepartmentAccessGroups(t *testing.T) {
	db := testDB(t)
	t.Cleanup(func() { db.Exec("TRUNCATE access_groups CASCADE") })
	users := UserStorageNew(db)
	employees := EmployeeStorageNew(db)
	s := AccessGroupStorageNew(db)
	ctx := context.Background()

	user := &models.User{FirstName: "Пётр", LastName: "Электриков", Email: "elektrikov_p@fesmu.ru", Status: enum.UserStatus_USER_STATUS_ACTIVE}
	userID, err := users.UserCreate(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	it := enum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_IT
	archive := enum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_ARKHIV

	if _, err := s.AccessGroupSave(ctx, &models.AccessGroup{Name: "ИТ-отдел"}, []string{"inventory.post"}, []enum.UserEmployeeDepartment{it}); err != nil {
		t.Fatal(err)
	}

	effective := func() ([]string, []enum.UserEmployeeDepartment) {
		u, err := users.UserByUUID(ctx, user.UUID)
		if err != nil {
			t.Fatal(err)
		}
		return u.EffectivePermissions(), u.DepartmentList()
	}
	if got, _ := effective(); len(got) != 0 {
		t.Fatalf("no department yet, got %v", got)
	}

	// В подразделение — права доступа подразделения приходят сами.
	if err := employees.EmployeeDepartmentsSet(ctx, userID, []enum.UserEmployeeDepartment{it, archive}); err != nil {
		t.Fatal(err)
	}
	if got, deps := effective(); !slices.Equal(got, []string{"inventory.post"}) || len(deps) != 2 {
		t.Fatalf("in IT: perms %v deps %v", got, deps)
	}

	// Перевели в другое — права ушли.
	if err := employees.EmployeeDepartmentsSet(ctx, userID, []enum.UserEmployeeDepartment{archive}); err != nil {
		t.Fatal(err)
	}
	if got, deps := effective(); len(got) != 0 || !slices.Equal(deps, []enum.UserEmployeeDepartment{archive}) {
		t.Fatalf("moved to archive: perms %v deps %v", got, deps)
	}

	// Список целиком (UserFetch) тоже получает права подразделений.
	if err := employees.EmployeeDepartmentsSet(ctx, userID, []enum.UserEmployeeDepartment{it}); err != nil {
		t.Fatal(err)
	}
	all, err := users.UserFetch(ctx)
	if err != nil || len(all) != 1 || !slices.Equal(all[0].EffectivePermissions(), []string{"inventory.post"}) {
		t.Fatalf("UserFetch: %v %v", all, err)
	}
}
