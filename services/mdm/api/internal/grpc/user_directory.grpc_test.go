package grpc

import (
	"context"
	"dvgmu/api/internal/service"
	enum "fesmu/contract/mdm/enum"
	pb "fesmu/contract/mdm/service"
	"net/http/httptest"
	"testing"
)

type queryDirectoryStore struct{ last *pb.UserDirectoryFetchRequest }

func (f *queryDirectoryStore) UserDirectoryFetch(_ context.Context, q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
	f.last = q
	return &pb.UserDirectoryFetchResponse{}, nil
}
func TestDirectoryQueryParameters(t *testing.T) {
	store := &queryDirectoryStore{}
	h := UserDirectoryNewController(service.NewUserDirectoryService(store))
	r := httptest.NewRequest("GET", "/users?role=student&faculty_code=20&course=2&student_group=201&include_facets=true&query=Ivanov", nil)
	w := httptest.NewRecorder()
	h.QueryHTTP(w, r)
	if w.Code != 200 || store.last == nil || store.last.Role != enum.UserRole_USER_ROLE_STUDENT || store.last.Course != 2 || store.last.StudentGroup != "201" || !store.last.IncludeFacets {
		t.Fatalf("query parameters lost: %d / %v", w.Code, store.last)
	}
	for _, url := range []string{"/users?role=student&employee_department=1", "/users?course=x", "/users?course=1&course=2", "/users?unknown=x"} {
		w = httptest.NewRecorder()
		h.QueryHTTP(w, httptest.NewRequest("GET", url, nil))
		if w.Code != 400 {
			t.Fatalf("must reject %s: %d", url, w.Code)
		}
	}
	w = httptest.NewRecorder()
	h.QueryHTTP(w, httptest.NewRequest("GET", "/users?role=staff&employee_department=1&employee_position=1", nil))
	if w.Code != 200 || store.last.EmployeeDepartment != 1 || store.last.EmployeePosition != "1" {
		t.Fatalf("employee filters failed: %d / %v", w.Code, store.last)
	}
}

func TestDirectoryProfileQueryDoesNotRequireManualStudentRole(t *testing.T) {
	store := &queryDirectoryStore{}
	h := UserDirectoryNewController(service.NewUserDirectoryService(store))
	w := httptest.NewRecorder()
	h.QueryHTTP(w, httptest.NewRequest("GET", "/users?profile_kind=student&active_students_only=true", nil))
	if w.Code != 200 || store.last == nil || store.last.Role != 0 || store.last.UserStatus != 0 || store.last.ProfileKind != "student" || !store.last.ActiveStudentsOnly {
		t.Fatalf("profile query unexpectedly requires a login role: %d / %v", w.Code, store.last)
	}
}
