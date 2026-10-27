package deanery_test

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"connectrpc.com/connect"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/timestamppb"

	mdmentity "fesmu/contract/mdm/entity"
	mdmenum "fesmu/contract/mdm/enum"
	mdmpb "fesmu/contract/mdm/service"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/modules/deanery"
)

const (
	studying = mdmenum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING
	expelled = mdmenum.UserStudentStatus_USER_STUDENT_STATUS_EXPELLED
	medDean  = mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_LECHEBNOGO_FAKULTETA
)

// fakeMDM — MDM в памяти: сотрудники по uuid, студенты, выданные коды.
type fakeMDM struct {
	staff    map[string]*mdmentity.User
	students []*mdmpb.StudentWithUser
	issued   []int64
	failFor  int64
}

func (f *fakeMDM) UserFetchByUUID(_ context.Context, req *connect.Request[mdmpb.UserFetchByUUIDRequest]) (*connect.Response[mdmpb.UserFetchByUUIDResponse], error) {
	u, ok := f.staff[req.Msg.GetUuid()]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("no user"))
	}
	return connect.NewResponse(&mdmpb.UserFetchByUUIDResponse{User: u}), nil
}

func (f *fakeMDM) StudentFetch(context.Context, *connect.Request[mdmpb.StudentFetchRequest]) (*connect.Response[mdmpb.StudentFetchResponse], error) {
	return connect.NewResponse(&mdmpb.StudentFetchResponse{Students: f.students}), nil
}

func (f *fakeMDM) ActivationIssue(_ context.Context, req *connect.Request[mdmpb.ActivationIssueRequest]) (*connect.Response[mdmpb.ActivationIssueResponse], error) {
	if req.Msg.GetId() == f.failFor {
		return nil, connect.NewError(connect.CodeInternal, errors.New("boom"))
	}
	f.issued = append(f.issued, req.Msg.GetId())
	return connect.NewResponse(&mdmpb.ActivationIssueResponse{
		Code:      "CODE-" + string(rune('A'+len(f.issued))),
		ExpiresAt: timestamppb.New(time.Now().Add(72 * time.Hour)),
	}), nil
}

func student(id int64, last, group, book string, status mdmenum.UserStudentStatus, linked bool) *mdmpb.StudentWithUser {
	u := &mdmentity.User{Id: id, LastName: last, FirstName: "Имя", Username: proto.String("s" + book)}
	if linked {
		u.AdObjectId = proto.String("guid-" + book)
	}
	return &mdmpb.StudentWithUser{
		Student: &mdmentity.Student{UserId: id, Group: group, RecordBook: book, Status: status},
		User:    u,
	}
}

func newModule() (*deanery.Module, *fakeMDM) {
	f := &fakeMDM{
		staff: map[string]*mdmentity.User{
			"meddean": {Id: 100, Departments: []mdmenum.UserEmployeeDepartment{medDean}},
			"other":   {Id: 101},
		},
		students: []*mdmpb.StudentWithUser{
			student(1, "Борисов", "309", "1021001", studying, true),
			student(2, "Андреев", "309", "1021002", studying, false),    // нет учётки AD
			student(3, "Волков", "101", "1025003", expelled, true),      // отчислен
			student(4, "Петров", "201", "2023004", studying, true),      // педиатрический
			student(5, "Неизвестный", "501", "9923005", studying, true), // факультет не определён
		},
	}
	return deanery.NewWithMDM(slog.New(slog.NewTextHandler(io.Discard, nil)), f, false), f
}

func as(uuid string, perms ...string) context.Context {
	return auth.WithUser(context.Background(), &auth.User{UUID: uuid, Username: uuid, Permissions: perms})
}

func ids(list []*pb.DeaneryStudent) []int64 {
	var out []int64
	for _, s := range list {
		out = append(out, s.GetUserId())
	}
	return out
}

func TestFetchOwnFacultySortedByGroup(t *testing.T) {
	m, _ := newModule()
	res, err := m.DeaneryStudentFetch(as("meddean"), connect.NewRequest(&pb.DeaneryStudentFetchRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	got := ids(res.Msg.GetStudents())
	// 101 Волков, затем 309 Андреев, Борисов; педиатрический и неизвестный скрыты.
	if want := []int64{3, 2, 1}; !equal(got, want) {
		t.Fatalf("students = %v, want %v", got, want)
	}
	if res.Msg.GetAllFaculties() || len(res.Msg.GetFaculties()) != 1 || res.Msg.GetFaculties()[0] != "Лечебный факультет" {
		t.Fatalf("scope = %v %v", res.Msg.GetAllFaculties(), res.Msg.GetFaculties())
	}
	s := res.Msg.GetStudents()
	if s[2].GetCourse() != 3 || !s[2].GetCanIssue() || s[2].GetLogin() != "s1021001" {
		t.Fatalf("Борисов = %v", s[2])
	}
	if s[1].GetCanIssue() || s[1].GetIssueBlocker() != "нет учётки AD" {
		t.Fatalf("Андреев = %v", s[1])
	}
	if s[0].GetCanIssue() || s[0].GetIssueBlocker() != "статус: Отчислен" {
		t.Fatalf("Волков = %v", s[0])
	}
}

func TestFetchWithoutDeaneryDepartmentSeesAll(t *testing.T) {
	m, _ := newModule()
	res, err := m.DeaneryStudentFetch(as("other"), connect.NewRequest(&pb.DeaneryStudentFetchRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	if !res.Msg.GetAllFaculties() || len(res.Msg.GetStudents()) != 5 {
		t.Fatalf("all = %v, n = %d", res.Msg.GetAllFaculties(), len(res.Msg.GetStudents()))
	}
}

func TestIssueOnlyEligibleInScope(t *testing.T) {
	m, f := newModule()
	res, err := m.DeaneryActivationIssue(as("meddean"), connect.NewRequest(&pb.DeaneryActivationIssueRequest{
		UserIds: []int64{1, 1, 2, 3, 4},
	}))
	if err != nil {
		t.Fatal(err)
	}
	if !equal(f.issued, []int64{1}) {
		t.Fatalf("issued = %v, want only 1", f.issued)
	}
	codes := res.Msg.GetCodes()
	if len(codes) != 4 {
		t.Fatalf("codes = %d, want 4 (dedup)", len(codes))
	}
	if codes[0].GetCode() == "" || codes[0].GetLogin() != "s1021001" || codes[0].GetExpiresAt() == nil {
		t.Fatalf("code for 1 = %v", codes[0])
	}
	for _, c := range codes[1:] {
		if c.GetCode() != "" || c.GetError() == "" {
			t.Fatalf("must not issue %d: %v", c.GetUserId(), c)
		}
	}
	if codes[3].GetError() != "студент не найден на вашем факультете" {
		t.Fatalf("other faculty = %v", codes[3])
	}
}

func TestIssueMDMFailureIsPerStudent(t *testing.T) {
	m, f := newModule()
	f.students = append(f.students, student(6, "Сидоров", "309", "1021006", studying, true))
	f.failFor = 1
	res, err := m.DeaneryActivationIssue(as("meddean"), connect.NewRequest(&pb.DeaneryActivationIssueRequest{UserIds: []int64{1, 6}}))
	if err != nil {
		t.Fatal(err)
	}
	c := res.Msg.GetCodes()
	if c[0].GetError() == "" || c[0].GetCode() != "" || c[1].GetCode() == "" {
		t.Fatalf("codes = %v", c)
	}
}

func TestIssueLimits(t *testing.T) {
	m, _ := newModule()
	if _, err := m.DeaneryActivationIssue(as("meddean"), connect.NewRequest(&pb.DeaneryActivationIssueRequest{})); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("empty: %v", err)
	}
	big := make([]int64, deanery.MaxIssue+1)
	for i := range big {
		big[i] = int64(i + 1)
	}
	if _, err := m.DeaneryActivationIssue(as("meddean"), connect.NewRequest(&pb.DeaneryActivationIssueRequest{UserIds: big})); connect.CodeOf(err) != connect.CodeInvalidArgument {
		t.Fatalf("too many: %v", err)
	}
	if _, err := m.DeaneryStudentFetch(context.Background(), connect.NewRequest(&pb.DeaneryStudentFetchRequest{})); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("anonymous: %v", err)
	}
}

func equal(a, b []int64) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestDemoIssuesEveryoneWithoutTouchingMDM(t *testing.T) {
	_, f := newModule()
	m := deanery.NewWithMDM(slog.New(slog.NewTextHandler(io.Discard, nil)), f, true)
	list, err := m.DeaneryStudentFetch(as("meddean"), connect.NewRequest(&pb.DeaneryStudentFetchRequest{}))
	if err != nil {
		t.Fatal(err)
	}
	if !list.Msg.GetDemo() {
		t.Fatal("demo flag not set")
	}
	for _, s := range list.Msg.GetStudents() {
		if !s.GetCanIssue() {
			t.Fatalf("demo: %d must be issuable", s.GetUserId())
		}
	}
	res, err := m.DeaneryActivationIssue(as("meddean"), connect.NewRequest(&pb.DeaneryActivationIssueRequest{UserIds: []int64{1, 2, 3, 4}}))
	if err != nil {
		t.Fatal(err)
	}
	// В MDM — только настоящий подходящий студент; чужой факультет — всё так же нельзя.
	if !equal(f.issued, []int64{1}) {
		t.Fatalf("mdm issued = %v, want [1]", f.issued)
	}
	c := res.Msg.GetCodes()
	if c[0].GetDemo() || c[0].GetCode() == "" {
		t.Fatalf("real code = %v", c[0])
	}
	for _, x := range c[1:3] {
		if !x.GetDemo() || x.GetCode() == "" || x.GetError() != "" {
			t.Fatalf("demo code = %v", x)
		}
	}
	if c[3].GetCode() != "" || c[3].GetError() == "" {
		t.Fatalf("other faculty in demo = %v", c[3])
	}
}
