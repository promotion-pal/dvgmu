package storage

import (
	"context"
	"errors"
	"os"
	"slices"
	"testing"

	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"dvgmu/api"
	"dvgmu/api/contract/gen/go/enum"
	"dvgmu/api/internal/domain/models"
)

// Нужен пустой Postgres: MDM_TEST_DB_DSN="postgres://u:p@localhost:5432/mdm_test?sslmode=disable".
// Без переменной тест пропускается.
func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("MDM_TEST_DB_DSN")
	if dsn == "" {
		t.Skip("MDM_TEST_DB_DSN not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}

	goose.SetBaseFS(api.MigrationsFS)
	goose.SetTableName("goose_db_version_user")
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(sqlDB, "migrations/user"); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	t.Cleanup(func() { db.Exec("TRUNCATE users CASCADE") })
	return db
}

func TestUserRolesSet(t *testing.T) {
	db := testDB(t)
	s := UserStorageNew(db)
	ctx := context.Background()

	user := &models.User{FirstName: "Иван", LastName: "Петров", Email: "petrov.i@fesmu.ru", Status: enum.UserStatus_USER_STATUS_ACTIVE}
	id, err := s.UserCreate(ctx, user)
	if err != nil {
		t.Fatal(err)
	}
	if user.UUID == "" {
		t.Fatal("uuid not returned by database default")
	}

	var (
		student = enum.UserRole_USER_ROLE_STUDENT
		staff   = enum.UserRole_USER_ROLE_STAFF
		teacher = enum.UserRole_USER_ROLE_TEACHER
	)

	steps := [][]enum.UserRole{
		{student, teacher},
		{teacher, staff}, // student снят, staff добавлен, teacher остался
		{enum.UserRole_USER_ROLE_ADMIN, teacher},
		{}, // снять все
	}
	for _, want := range steps {
		if err := s.UserRolesSet(ctx, id, want); err != nil {
			t.Fatalf("set %v: %v", want, err)
		}
		got, err := s.UserByUUID(ctx, user.UUID)
		if err != nil {
			t.Fatal(err)
		}
		norm, _ := models.NormalizeRoles(want)
		if !slices.Equal(got.RoleList(), norm) {
			t.Fatalf("roles = %v, want %v", got.RoleList(), norm)
		}
	}

	if err := s.UserRolesSet(ctx, id+1000, []enum.UserRole{student}); !errors.Is(err, models.ErrUserNotFound) {
		t.Fatalf("unknown user: err = %v", err)
	}
	guid := "0b3a2c1d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"
	if err := db.Model(&models.User{}).Where("id = ?", id).Update("ad_object_id", guid).Error; err != nil {
		t.Fatal(err)
	}
	if got, err := s.UserByADObjectID(ctx, guid); err != nil || got.ID != id {
		t.Fatalf("by ad object id: %v, %v", got, err)
	}

	other := &models.User{FirstName: "Пётр", LastName: "Сидоров", Email: "sidorov.p@fesmu.ru", Status: enum.UserStatus_USER_STATUS_ACTIVE}
	otherID, err := s.UserCreate(ctx, other)
	if err != nil {
		t.Fatal(err)
	}
	guid2 := "1c4b3d2e-5f6a-4b7c-9d8e-0f1a2b3c4d5e"
	linked, skipped, err := s.UserADLinkBatch(ctx, []models.ADLink{
		{UserID: otherID, ADObjectID: guid2},                                        // ok
		{UserID: otherID, ADObjectID: guid2},                                        // повтор — тот же GUID, ok
		{UserID: id, ADObjectID: guid2},                                             // у id уже другой GUID → skip
		{UserID: otherID, ADObjectID: guid},                                         // guid занят id → skip
		{UserID: otherID + 999, ADObjectID: "9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f"}, // нет пользователя → skip
		{UserID: otherID, ADObjectID: "not-a-guid"},                                 // skip
	})
	if err != nil {
		t.Fatal(err)
	}
	if linked != 2 || len(skipped) != 4 {
		t.Fatalf("linked=%d skipped=%v", linked, skipped)
	}
	if got, _ := s.UserByADObjectID(ctx, guid2); got == nil || got.ID != otherID {
		t.Fatalf("guid2 not linked to other: %v", got)
	}

	// Права: замена набора целиком, читаются вместе с пользователем.
	for _, want := range [][]string{
		{"certificate.issue", "certificate.view"},
		{"certificate.view"},
		{},
	} {
		if err := s.UserPermissionsSet(ctx, id, want); err != nil {
			t.Fatalf("permissions %v: %v", want, err)
		}
		got, err := s.UserByUUID(ctx, user.UUID)
		if err != nil {
			t.Fatal(err)
		}
		if !slices.Equal(got.PermissionList(), want) {
			t.Fatalf("permissions = %v, want %v", got.PermissionList(), want)
		}
	}
	// Формат проверяет и база (CHECK), даже в обход сервиса.
	if err := s.UserPermissionsSet(ctx, id, []string{"Bad Perm"}); err == nil {
		t.Fatal("database accepted a malformed permission")
	}

	if _, err := s.UserByUUID(ctx, "not-a-uuid"); !errors.Is(err, models.ErrUserNotFound) {
		t.Fatalf("bad uuid: err = %v", err)
	}
}
