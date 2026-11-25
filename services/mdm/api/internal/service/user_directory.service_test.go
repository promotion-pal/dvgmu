package service

import (
	"context"
	"errors"
	enum "fesmu/contract/mdm/enum"
	pb "fesmu/contract/mdm/service"
	"testing"
)

type directoryTestStore struct{ query *pb.UserDirectoryFetchRequest }

func (f *directoryTestStore) UserDirectoryFetch(_ context.Context, q *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
	f.query = q
	return &pb.UserDirectoryFetchResponse{}, nil
}
func TestDirectoryFiltersValidateRoleFeaturesBeforeFetching(t *testing.T) {
	invalid := []*pb.UserDirectoryFetchRequest{
		{Role: 999}, {Course: 7}, {Limit: 201}, {Offset: -1}, {RecordBook: "invalid"}, {Role: enum.UserRole_USER_ROLE_STAFF, Course: 2},
		{Role: enum.UserRole_USER_ROLE_STUDENT, EmployeeDepartment: 1}, {Course: 2, EmployeePosition: "Врач"}, {UserUuids: []string{"bad"}}, {ProfileKind: "bad"}, {ProfileKind: "employee", Course: 2},
	}
	for _, q := range invalid {
		store := &directoryTestStore{}
		_, err := NewUserDirectoryService(store).Fetch(context.Background(), q)
		if !errors.Is(err, ErrDirectoryQuery) || store.query != nil {
			t.Fatalf("invalid query reached storage: %v / %v", q, err)
		}
	}
}
func TestDirectoryStudentFiltersAreServerSideAndDoNotMutateCaller(t *testing.T) {
	store := &directoryTestStore{}
	query := &pb.UserDirectoryFetchRequest{Course: 2, StudentGroup: " 201 ", Query: " Иванов  Иван "}
	if _, err := NewUserDirectoryService(store).Fetch(context.Background(), query); err != nil {
		t.Fatal(err)
	}
	if (store.query.Role != 0 || store.query.ProfileKind != "student") || store.query.StudentGroup != "201" || store.query.Limit != 50 || store.query.Query != "Иванов Иван" {
		t.Fatalf("normalization failed: %v", store.query)
	}
	if query.Role != 0 || query.StudentGroup != " 201 " {
		t.Fatal("caller query mutated")
	}
}
