package certificate

import (
	"dvgmu/api/internal/faculty"

	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"connectrpc.com/connect"

	fileentity "fesmu/contract/file/entity"
	fileenum "fesmu/contract/file/enum"
	filespb "fesmu/contract/file/service"
	entity "fesmu/contract/mdm/entity"
	mdmenum "fesmu/contract/mdm/enum"
	mdmpb "fesmu/contract/mdm/service"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
)

const (
	studentID  = 501 // лечебный (зачётка 10…)
	otherID    = 502 // педиатрический (20…)
	noBookID   = 503 // зачётки нет
	clerkID    = 900 // без деканата — все факультеты
	medDeanID  = 901 // деканат лечебного
	enrollment = fileenum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_CERTIFICATE_ENROLLMENT
)

var students = map[int64]struct{ name, book, group string }{
	studentID: {"Иванов", "1023001", "101"},
	otherID:   {"Петров", "2024015", "205"},
	noBookID:  {"Сидоров", "", ""},
	clerkID:   {"Сидорова", "", ""},
}

type fakeMDM struct{}

func (fakeMDM) UserFetchByID(_ context.Context, req *connect.Request[mdmpb.UserFetchByIDRequest]) (*connect.Response[mdmpb.UserFetchByIDResponse], error) {
	st, ok := students[req.Msg.GetId()]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("no user"))
	}
	return connect.NewResponse(&mdmpb.UserFetchByIDResponse{
		Profile: &entity.UserFull{
			User:    &entity.User{Id: req.Msg.GetId(), LastName: st.name, FirstName: "И."},
			Student: &entity.Student{RecordBook: st.book, Group: st.group},
		},
	}), nil
}

func (fakeMDM) UserFetchByUUID(_ context.Context, req *connect.Request[mdmpb.UserFetchByUUIDRequest]) (*connect.Response[mdmpb.UserFetchByUUIDResponse], error) {
	users := map[string]*entity.User{
		"u-student": {Id: studentID},
		"u-other":   {Id: otherID},
		"u-clerk":   {Id: clerkID},
		"u-meddean": {Id: medDeanID},
	}
	u := users[req.Msg.GetUuid()]
	u.LastName, u.FirstName = "Кто-то", req.Msg.GetUuid()
	response := &mdmpb.UserFetchByUUIDResponse{User: u}
	if req.Msg.GetUuid() == "u-meddean" {
		response.Departments = []mdmenum.UserEmployeeDepartment{
			mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_LECHEBNOGO_FAKULTETA,
		}
	}
	return connect.NewResponse(response), nil
}

type fakeFiles struct{}

func (fakeFiles) FileGenerate(context.Context, *connect.Request[filespb.FileGenerateRequest]) (*connect.Response[filespb.FileGenerateResponse], error) {
	return connect.NewResponse(&filespb.FileGenerateResponse{Success: true, File: &fileentity.File{FileName: "справка.docx"}, Content: []byte("doc")}), nil
}

type fakeStore struct{ rows []*models.CertificateOrder }

func (f *fakeStore) CertificateOrderCreate(_ context.Context, o *models.CertificateOrder) error {
	o.ID = int64(len(f.rows) + 1)
	o.CreatedAt = time.Now()
	f.rows = append(f.rows, o)
	return nil
}

func (f *fakeStore) CertificateOrderFetch(_ context.Context, status pb.CertificateOrderStatus) ([]*models.CertificateOrder, error) {
	var out []*models.CertificateOrder
	for _, r := range f.rows {
		if status == pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_UNSPECIFIED || r.Status == status {
			cp := *r
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (f *fakeStore) CertificateOrderFetchByStudent(_ context.Context, id int64) ([]*models.CertificateOrder, error) {
	var out []*models.CertificateOrder
	for _, r := range f.rows {
		if r.StudentMdmID == id {
			cp := *r
			out = append(out, &cp)
		}
	}
	return out, nil
}

func (f *fakeStore) row(id int64) *models.CertificateOrder {
	for _, r := range f.rows {
		if r.ID == id {
			return r
		}
	}
	return nil
}

func (f *fakeStore) CertificateOrderByID(_ context.Context, id int64) (*models.CertificateOrder, error) {
	if r := f.row(id); r != nil {
		cp := *r
		return &cp, nil
	}
	return nil, models.ErrCertificateOrderNotFound
}

func (f *fakeStore) CertificateOrderSetFaculty(_ context.Context, id int64, faculty int32, group, book string) error {
	r := f.row(id)
	r.FacultyCode, r.Group, r.RecordBook = faculty, group, book
	return nil
}

func (f *fakeStore) CertificateOrderMarkReady(_ context.Context, id int64, by string, at time.Time) error {
	if r := f.row(id); r.Status == statusOrdered {
		r.Status, r.PreparedBy, r.ReadyAt = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_READY, by, &at
	}
	return nil
}

func (f *fakeStore) CertificateOrderMarkIssued(_ context.Context, id int64, by string, at time.Time) error {
	if r := f.row(id); r.Status == statusOrdered || r.Status == pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_READY {
		r.Status, r.IssuedBy, r.IssuedAt = statusIssued, by, &at
	}
	return nil
}

func (f *fakeStore) CertificateOrderCancel(_ context.Context, id int64, reason, by string) error {
	if r := f.row(id); r.Status != statusIssued {
		r.Status, r.CancelReason, r.PreparedBy = statusCancelled, reason, by
	}
	return nil
}

func newService() (*Service, *fakeStore) {
	store := &fakeStore{}
	return NewService(slog.New(slog.NewTextHandler(io.Discard, nil)), fakeMDM{}, fakeFiles{}, store), store
}

func as(uuid string, perms ...string) context.Context {
	return auth.WithUser(context.Background(), &auth.User{UUID: uuid, Permissions: perms})
}

var (
	view = auth.Perm(auth.SectionCertificate, auth.ActionFetch)
	post = auth.Perm(auth.SectionCertificate, auth.ActionPost)
)

func code(err error) connect.Code { return connect.CodeOf(err) }

func mustOrder(t *testing.T, s *Service, who string) {
	t.Helper()
	resp, err := s.CertificateOrder(as(who), &pb.CertificateOrderRequest{Type: enrollment, Copies: 1})
	if err != nil || !resp.GetSuccess() {
		t.Fatalf("order as %s: %v %v", who, resp, err)
	}
}

func TestFacultyFromRecordBook(t *testing.T) {
	cases := map[string]int32{"1023001": faculty.Medical, "2024015": faculty.Pediatric, "3021001": faculty.Dental,
		"4020001": faculty.Pharmacy, "7120001": faculty.Humanities, "9920001": faculty.Unknown, "": faculty.Unknown, "1": faculty.Unknown, "ab12": faculty.Unknown}
	for book, want := range cases {
		if got := faculty.FromRecordBook(book); got != want {
			t.Errorf("%q: got %d, want %d", book, got, want)
		}
	}
}

func TestOrder_StudentGetsNoFileOnlyStatus(t *testing.T) {
	s, store := newService()
	resp, err := s.CertificateOrder(as("u-student"), &pb.CertificateOrderRequest{Type: enrollment, Copies: 2})
	if err != nil || !resp.GetSuccess() || len(resp.GetContent()) != 0 {
		t.Fatalf("student order must succeed without a file: %v %v", resp, err)
	}
	o := store.rows[0]
	if o.StudentMdmID != studentID || o.Status != statusOrdered || o.Copies != 2 || o.FacultyCode != faculty.Medical || o.Group != "101" {
		t.Fatalf("journal row: %+v", o)
	}

	mine, err := s.CertificateMyFetch(as("u-student"), &pb.CertificateMyFetchRequest{})
	if err != nil || len(mine.GetOrders()) != 1 || mine.GetOrders()[0].GetFaculty() != "Лечебный факультет" {
		t.Fatalf("my orders: %v %v", mine, err)
	}
	theirs, _ := s.CertificateMyFetch(as("u-other"), &pb.CertificateMyFetchRequest{})
	if len(theirs.GetOrders()) != 0 {
		t.Fatal("another student sees someone else's order")
	}
}

func TestOrder_SelfOnlyWithoutRight(t *testing.T) {
	s, store := newService()
	_, err := s.CertificateOrder(as("u-student"), &pb.CertificateOrderRequest{UserId: otherID, Type: enrollment, Copies: 1})
	if code(err) != connect.CodePermissionDenied || len(store.rows) != 0 {
		t.Fatalf("other without right: err=%v rows=%d", err, len(store.rows))
	}
}

func TestOrder_OnBehalfIssuedWithFile(t *testing.T) {
	s, store := newService()
	resp, err := s.CertificateOrder(as("u-clerk", post), &pb.CertificateOrderRequest{UserId: otherID, Type: enrollment, Copies: 1})
	if err != nil || !resp.GetSuccess() || len(resp.GetContent()) == 0 {
		t.Fatalf("on behalf: %v %v", resp, err)
	}
	if o := store.rows[0]; o.Status != statusIssued || o.IssuedAt == nil || o.FacultyCode != faculty.Pediatric {
		t.Fatalf("on-behalf order must be issued at once: %+v", o)
	}
}

func TestOrder_RejectsBadInput(t *testing.T) {
	s, _ := newService()
	military := fileenum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_MILITARY_REGISTRATION_CARD
	if _, err := s.CertificateOrder(as("u-student"), &pb.CertificateOrderRequest{Type: military, Copies: 1}); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("non-certificate document: %v", err)
	}
	if _, err := s.CertificateOrder(as("u-student"), &pb.CertificateOrderRequest{Type: enrollment, Copies: 50}); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("50 copies: %v", err)
	}
	if _, err := s.CertificateOrder(context.Background(), &pb.CertificateOrderRequest{Type: enrollment, Copies: 1}); code(err) != connect.CodeUnauthenticated {
		t.Fatalf("no user: %v", err)
	}
}

func TestJournal_DeaneryScope(t *testing.T) {
	s, _ := newService()
	mustOrder(t, s, "u-student") // лечебный, id 1
	mustOrder(t, s, "u-other")   // педиатрический, id 2

	if _, err := s.CertificateFetch(as("u-student"), &pb.CertificateFetchRequest{}); code(err) != connect.CodePermissionDenied {
		t.Fatalf("student must not see the journal: %v", err)
	}

	dean, err := s.CertificateFetch(as("u-meddean", view), &pb.CertificateFetchRequest{})
	if err != nil || len(dean.GetOrders()) != 1 || dean.GetOrders()[0].GetStudentMdmId() != studentID || dean.GetAllFaculties() {
		t.Fatalf("medical deanery sees only its faculty: %v %v", dean, err)
	}
	if len(dean.GetFaculties()) != 1 || dean.GetFaculties()[0] != "Лечебный факультет" {
		t.Fatalf("faculties: %v", dean.GetFaculties())
	}

	all, err := s.CertificateFetch(as("u-clerk", view), &pb.CertificateFetchRequest{})
	if err != nil || len(all.GetOrders()) != 2 || !all.GetAllFaculties() {
		t.Fatalf("staff without a deanery sees all: %v %v", all, err)
	}
	admin := auth.WithUser(context.Background(), &auth.User{UUID: "u-meddean", Roles: []string{auth.RoleAdmin}})
	if a, err := s.CertificateFetch(admin, &pb.CertificateFetchRequest{}); err != nil || len(a.GetOrders()) != 2 {
		t.Fatalf("admin sees all: %v %v", a, err)
	}

	// Чужой факультет — ни печати, ни выдачи, ни отклонения.
	if _, err := s.CertificatePrint(as("u-meddean", post), &pb.CertificatePrintRequest{Id: 2}); code(err) != connect.CodePermissionDenied {
		t.Fatalf("print other faculty: %v", err)
	}
	if _, err := s.CertificateIssue(as("u-meddean", post), &pb.CertificateIssueRequest{Id: 2}); code(err) != connect.CodePermissionDenied {
		t.Fatalf("issue other faculty: %v", err)
	}
	if _, err := s.CertificateCancel(as("u-meddean", post), &pb.CertificateCancelRequest{Id: 2, Reason: "x"}); code(err) != connect.CodePermissionDenied {
		t.Fatalf("cancel other faculty: %v", err)
	}
}

func TestFlow_PrintReadyIssue(t *testing.T) {
	s, store := newService()
	mustOrder(t, s, "u-student")

	if _, err := s.CertificatePrint(as("u-meddean", view), &pb.CertificatePrintRequest{Id: 1}); code(err) != connect.CodePermissionDenied {
		t.Fatalf("print with only view: %v", err)
	}
	printed, err := s.CertificatePrint(as("u-meddean", post), &pb.CertificatePrintRequest{Id: 1})
	if err != nil || len(printed.GetContent()) == 0 || printed.GetOrder().GetStatus() != pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_READY || printed.GetOrder().GetReadyAt() == nil {
		t.Fatalf("print: %v %v", printed, err)
	}
	firstReady := *store.rows[0].ReadyAt

	// Перепечатка — статус и время «готова» не меняются.
	if _, err := s.CertificatePrint(as("u-meddean", post), &pb.CertificatePrintRequest{Id: 1}); err != nil {
		t.Fatal(err)
	}
	if !store.rows[0].ReadyAt.Equal(firstReady) {
		t.Fatal("reprint changed ready time")
	}

	issued, err := s.CertificateIssue(as("u-meddean", post), &pb.CertificateIssueRequest{Id: 1})
	if err != nil || issued.GetOrder().GetStatus() != statusIssued || len(issued.GetContent()) != 0 {
		t.Fatalf("issue: %v %v", issued, err)
	}
	// Студент видит «выдана».
	mine, _ := s.CertificateMyFetch(as("u-student"), &pb.CertificateMyFetchRequest{})
	if mine.GetOrders()[0].GetStatus() != statusIssued {
		t.Fatalf("student status: %v", mine.GetOrders()[0].GetStatus())
	}
	// Выданную не отклонить.
	if _, err := s.CertificateCancel(as("u-meddean", post), &pb.CertificateCancelRequest{Id: 1, Reason: "ошибка"}); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("cancel issued: %v", err)
	}
}

func TestFlow_Cancel(t *testing.T) {
	s, _ := newService()
	mustOrder(t, s, "u-student")

	if _, err := s.CertificateCancel(as("u-meddean", post), &pb.CertificateCancelRequest{Id: 1, Reason: "  "}); code(err) != connect.CodeInvalidArgument {
		t.Fatalf("cancel without reason: %v", err)
	}
	c, err := s.CertificateCancel(as("u-meddean", post), &pb.CertificateCancelRequest{Id: 1, Reason: "Нет данных о зачислении"})
	if err != nil || c.GetOrder().GetStatus() != statusCancelled || c.GetOrder().GetCancelReason() != "Нет данных о зачислении" {
		t.Fatalf("cancel: %v %v", c, err)
	}
	if _, err := s.CertificatePrint(as("u-meddean", post), &pb.CertificatePrintRequest{Id: 1}); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("print cancelled: %v", err)
	}
	if _, err := s.CertificateIssue(as("u-meddean", post), &pb.CertificateIssueRequest{Id: 1}); code(err) != connect.CodeFailedPrecondition {
		t.Fatalf("issue cancelled: %v", err)
	}
}

func TestJournal_UnknownFacultyOnlyForAll(t *testing.T) {
	s, store := newService()
	// Старый заказ без факультета; у студента зачётки нет — так и остаётся.
	store.rows = append(store.rows, &models.CertificateOrder{ID: 1, StudentMdmID: noBookID, Status: statusOrdered, Type: enrollment})
	// Старый заказ без факультета; зачётка в MDM есть — уточняется.
	store.rows = append(store.rows, &models.CertificateOrder{ID: 2, StudentMdmID: studentID, Status: statusOrdered, Type: enrollment})

	dean, _ := s.CertificateFetch(as("u-meddean", view), &pb.CertificateFetchRequest{})
	if len(dean.GetOrders()) != 1 || dean.GetOrders()[0].GetId() != 2 {
		t.Fatalf("deanery sees only the backfilled medical order: %v", dean.GetOrders())
	}
	if store.rows[1].FacultyCode != faculty.Medical {
		t.Fatalf("backfill not saved: %+v", store.rows[1])
	}
	all, _ := s.CertificateFetch(as("u-clerk", view), &pb.CertificateFetchRequest{})
	if len(all.GetOrders()) != 2 || all.GetOrders()[0].GetFaculty() != "" {
		t.Fatalf("unknown faculty visible to all-faculty staff: %v", all.GetOrders())
	}
}
