package storage

import (
	"context"
	"dvgmu/api/internal/domain/models"
	enum "fesmu/contract/mdm/enum"
	pb "fesmu/contract/mdm/service"
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"strings"
	"testing"
	"time"
)

func TestDirectorySQLBindsFiltersWithoutDuplicateJoins(t *testing.T) {
	db, err := gorm.Open(postgres.New(postgres.Config{DSN: "host=localhost user=test dbname=test"}), &gorm.Config{DryRun: true, DisableAutomaticPing: true})
	if err != nil {
		t.Fatal(err)
	}
	q := &pb.UserDirectoryFetchRequest{Role: enum.UserRole_USER_ROLE_STUDENT, FacultyCode: 20, Course: 2, StudentGroup: "201", RecordBook: "2025001"}
	tx := directoryUsers(q, db.Model(&directoryUser{})).Find(&[]directoryUser{})
	sql := tx.Statement.SQL.String()
	if !strings.Contains(sql, "EXISTS (SELECT 1 FROM user_roles") || !strings.Contains(sql, "EXISTS (SELECT 1 FROM \"students\"") || !strings.Contains(sql, "students.record_book") || !strings.Contains(sql, "students.\"group\"") {
		t.Fatalf("filters missing: %s", sql)
	}
	if strings.Contains(sql, "2025001") || len(tx.Statement.Vars) < 5 {
		t.Fatalf("filters must be bound parameters: %s / %v", sql, tx.Statement.Vars)
	}
}
func TestUserDirectoryPostgresPaginationAndFacets(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	dir := UserDirectoryStorageNew(db)
	year := (time.Now().Year() - 1) % 100
	for i := 1; i <= 2; i++ {
		u := &models.User{FirstName: "Test", LastName: fmt.Sprintf("DirectoryTarget%d", i), Email: fmt.Sprintf("directory%d@example.test", i), Roles: []models.UserRole{{Role: enum.UserRole_USER_ROLE_STUDENT}}, Student: &models.Student{Group: "DIR201", RecordBook: fmt.Sprintf("20%02d%03d", year, i), Status: enum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING}}
		if err := db.Create(u).Error; err != nil {
			t.Fatal(err)
		}
		if i == 1 {
			if err := db.Create(&models.Student{UserID: u.ID, Group: "DIR201", RecordBook: fmt.Sprintf("20%02d999", year), Status: enum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING}).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	q := &pb.UserDirectoryFetchRequest{Role: enum.UserRole_USER_ROLE_STUDENT, Query: "DirectoryTarget", Course: 2, FacultyCode: 20, StudentGroup: "DIR201", StudentStatus: enum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING, Limit: 1, IncludeFacets: true}
	page, err := dir.UserDirectoryFetch(ctx, q)
	if err != nil {
		t.Fatal(err)
	}
	if page.Total != 2 || len(page.Users) != 1 || page.NextOffset != 1 {
		t.Fatalf("pagination counts duplicated users: %v", page)
	}
	found := false
	for _, f := range page.StudentFacets {
		if f.Group == "DIR201" && f.FacultyCode == 20 {
			found = true
			if f.Count != 2 {
				t.Fatalf("facet counted duplicate enrollments: %v", f)
			}
		}
	}
	if !found {
		t.Fatal("missing student facet")
	}
	first := page.Users[0].Uuid
	q.Offset = 1
	page, err = dir.UserDirectoryFetch(ctx, q)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Users) != 1 || page.Users[0].Uuid == first || page.NextOffset != 0 {
		t.Fatalf("unstable page: %v", page)
	}
}
