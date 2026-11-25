package service

import (
	"context"
	"errors"
	enum "fesmu/contract/mdm/enum"
	pb "fesmu/contract/mdm/service"
	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
	"regexp"
	"strings"
)

var ErrDirectoryQuery = errors.New("некорректные фильтры справочника")
var directoryRecordBook = regexp.MustCompile(`^[0-9]{7}$`)

type UserDirectoryStore interface {
	UserDirectoryFetch(context.Context, *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error)
}
type UserDirectoryService struct{ store UserDirectoryStore }

func NewUserDirectoryService(store UserDirectoryStore) *UserDirectoryService {
	return &UserDirectoryService{store: store}
}
func (s *UserDirectoryService) Fetch(ctx context.Context, input *pb.UserDirectoryFetchRequest) (*pb.UserDirectoryFetchResponse, error) {
	q := proto.Clone(input).(*pb.UserDirectoryFetchRequest)
	q.Query = strings.Join(strings.Fields(q.Query), " ")
	q.StudentGroup = strings.TrimSpace(q.StudentGroup)
	q.RecordBook = strings.TrimSpace(q.RecordBook)
	q.EmployeePosition = strings.TrimSpace(q.EmployeePosition)
	if q.Limit == 0 {
		q.Limit = 50
	}
	_, roleOK := enum.UserRole_name[int32(q.Role)]
	_, userStatusOK := enum.UserStatus_name[int32(q.UserStatus)]
	_, studentStatusOK := enum.UserStudentStatus_name[int32(q.StudentStatus)]
	_, departmentOK := enum.UserEmployeeDepartment_name[int32(q.EmployeeDepartment)]
	if !userStatusOK || !roleOK || !studentStatusOK || !departmentOK || q.Course < 0 || q.Course > 6 || q.FacultyCode < 0 || q.FacultyCode > 99 || q.Limit < 1 || q.Limit > 200 || q.Offset < 0 || len([]rune(q.Query)) > 100 || len(q.EmployeePosition) > 255 || len(q.StudentGroup) > 255 || len(q.UserUuids) > 200 || (q.RecordBook != "" && !directoryRecordBook.MatchString(q.RecordBook)) {
		return nil, ErrDirectoryQuery
	}
	if q.ProfileKind != "" && q.ProfileKind != "student" && q.ProfileKind != "employee" {
		return nil, ErrDirectoryQuery
	}
	studentFilter := q.ProfileKind == "student" || q.ActiveStudentsOnly || q.Course > 0 || q.FacultyCode > 0 || q.StudentGroup != "" || q.RecordBook != "" || q.StudentStatus != 0
	employeeFilter := q.ProfileKind == "employee" || q.EmployeeDepartment != 0 || q.EmployeePosition != ""
	if studentFilter && employeeFilter {
		return nil, ErrDirectoryQuery
	}
	if studentFilter && q.Role != 0 && q.Role != enum.UserRole_USER_ROLE_STUDENT {
		return nil, ErrDirectoryQuery
	}
	if employeeFilter && q.Role == enum.UserRole_USER_ROLE_STUDENT {
		return nil, ErrDirectoryQuery
	}
	if studentFilter && q.Role == 0 {
		q.ProfileKind = "student"
	}
	for _, id := range q.UserUuids {
		if _, err := uuid.Parse(id); err != nil {
			return nil, ErrDirectoryQuery
		}
	}
	return s.store.UserDirectoryFetch(ctx, q)
}
