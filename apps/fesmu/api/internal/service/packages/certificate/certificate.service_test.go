package certificate

import (
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
	mdmpb "fesmu/contract/mdm/service"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
)

const (
	studentID  = 501
	otherID    = 502
	clerkID    = 900
	enrollment = fileenum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_CERTIFICATE_ENROLLMENT
)

type fakeMDM struct{}

func (fakeMDM) UserFetchByID(_ context.Context, req *connect.Request[mdmpb.UserFetchByIDRequest]) (*connect.Response[mdmpb.UserFetchByIDResponse], error) {
	names := map[int64]string{studentID: "Иванов", otherID: "Петров", clerkID: "Сидорова"}
	name, ok := names[req.Msg.GetId()]
	if !ok {
		return nil, connect.NewError(connect.CodeNotFound, errors.New("no user"))
	}
	return connect.NewResponse(&mdmpb.UserFetchByIDResponse{
		Profile: &entity.UserFull{User: &entity.User{Id: req.Msg.GetId(), LastName: name, FirstName: "И."}},
	}), nil
}

func (fakeMDM) UserFetchByUUID(_ context.Context, req *connect.Request[mdmpb.UserFetchByUUIDRequest]) (*connect.Response[mdmpb.UserFetchByUUIDResponse], error) {
	ids := map[string]int64{"u-student": studentID, "u-clerk": clerkID}
	return connect.NewResponse(&mdmpb.UserFetchByUUIDResponse{
		User: &entity.User{Id: ids[req.Msg.GetUuid()], LastName: "Кто-то", FirstName: req.Msg.GetUuid()},
	}), nil
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

func (f *fakeStore) CertificateOrderFetch(context.Context, pb.CertificateOrderStatus) ([]*models.CertificateOrder, error) {
	return f.rows, nil
}

func (f *fakeStore) CertificateOrderByID(_ context.Context, id int64) (*models.CertificateOrder, error) {
	for _, r := range f.rows {
		if r.ID == id {
			cp := *r
			return &cp, nil
		}
	}
	return nil, models.ErrCertificateOrderNotFound
}

func (f *fakeStore) CertificateOrderMarkIssued(_ context.Context, id int64, by string, at time.Time) error {
	for _, r := range f.rows {
		if r.ID == id && r.Status == pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ORDERED {
			r.Status, r.IssuedBy, r.IssuedAt = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ISSUED, by, &at
		}
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

func code(err error) connect.Code { return connect.CodeOf(err) }

func TestOrder_SelfOnlyWithoutRight(t *testing.T) {
	s, store := newService()

	// user_id 0 — на себя.
	resp, err := s.CertificateOrder(as("u-student"), &pb.CertificateOrderRequest{Type: enrollment, Copies: 2})
	if err != nil || !resp.GetSuccess() {
		t.Fatalf("self order: %v %v", resp, err)
	}
	if o := store.rows[0]; o.StudentMdmID != studentID || o.Status != pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ORDERED || o.Copies != 2 {
		t.Fatalf("journal row: %+v", o)
	}

	// Чужой id без права — отказ, в журнал ничего.
	_, err = s.CertificateOrder(as("u-student"), &pb.CertificateOrderRequest{UserId: otherID, Type: enrollment, Copies: 1})
	if code(err) != connect.CodePermissionDenied || len(store.rows) != 1 {
		t.Fatalf("other without right: err=%v rows=%d", err, len(store.rows))
	}
}

func TestOrder_OnBehalfWithIssueRight(t *testing.T) {
	s, store := newService()
	resp, err := s.CertificateOrder(as("u-clerk", auth.Perm(auth.SectionCertificate, auth.ActionPost)), &pb.CertificateOrderRequest{UserId: otherID, Type: enrollment, Copies: 1})
	if err != nil || !resp.GetSuccess() {
		t.Fatalf("on behalf: %v %v", resp, err)
	}
	o := store.rows[0]
	if o.StudentMdmID != otherID || o.Status != pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ISSUED || o.IssuedBy == "" || o.IssuedAt == nil {
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

func TestJournalAndIssue_NeedRights(t *testing.T) {
	s, store := newService()
	if _, err := s.CertificateOrder(as("u-student"), &pb.CertificateOrderRequest{Type: enrollment, Copies: 1}); err != nil {
		t.Fatal(err)
	}

	if _, err := s.CertificateFetch(as("u-student"), &pb.CertificateFetchRequest{}); code(err) != connect.CodePermissionDenied {
		t.Fatalf("fetch without right: %v", err)
	}
	list, err := s.CertificateFetch(as("u-clerk", auth.Perm(auth.SectionCertificate, auth.ActionFetch)), &pb.CertificateFetchRequest{})
	if err != nil || len(list.GetOrders()) != 1 {
		t.Fatalf("fetch with view: %v %v", list, err)
	}

	if _, err := s.CertificateIssue(as("u-clerk", auth.Perm(auth.SectionCertificate, auth.ActionFetch)), &pb.CertificateIssueRequest{Id: 1}); code(err) != connect.CodePermissionDenied {
		t.Fatalf("issue with only view: %v", err)
	}
	issued, err := s.CertificateIssue(as("u-clerk", auth.Perm(auth.SectionCertificate, auth.ActionPost)), &pb.CertificateIssueRequest{Id: 1})
	if err != nil || issued.GetOrder().GetStatus() != pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ISSUED || len(issued.GetContent()) == 0 {
		t.Fatalf("issue: %v %v", issued, err)
	}
	first := *store.rows[0].IssuedAt

	// Повторная выдача — перепечатка, первая выдача остаётся.
	if _, err := s.CertificateIssue(as("u-clerk", auth.Perm(auth.SectionCertificate, auth.ActionPost)), &pb.CertificateIssueRequest{Id: 1}); err != nil {
		t.Fatal(err)
	}
	if !store.rows[0].IssuedAt.Equal(first) {
		t.Fatal("reprint changed the first issue time")
	}

	// Администратор — без явных прав.
	admin := auth.WithUser(context.Background(), &auth.User{UUID: "u-clerk", Roles: []string{auth.RoleAdmin}})
	if _, err := s.CertificateFetch(admin, &pb.CertificateFetchRequest{}); err != nil {
		t.Fatalf("admin fetch: %v", err)
	}
}
