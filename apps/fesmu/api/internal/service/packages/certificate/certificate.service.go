// Package certificate is this api's own capability, not a passthrough to an
// external package: it looks the student up in mdm by id, then asks the
// files service to render the requested certificate from that profile — the
// same combine-two-services shape as user.ImportService. Every order goes
// into the certificate journal.
package certificate

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"connectrpc.com/connect"

	fileenum "fesmu/contract/file/enum"
	filespb "fesmu/contract/file/service"
	entity "fesmu/contract/mdm/entity"
	mdmpb "fesmu/contract/mdm/service"
	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/domain/models"
)

// Only these are certificates; the files service renders other documents too.
var orderable = map[fileenum.FileGenerateType]bool{
	fileenum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_STUDY_CERTIFICATE:                  true,
	fileenum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_CERTIFICATE_ENROLLMENT: true,
}

const maxCopies = 10

// Profiles is the slice of mdm's UserService the journal needs.
type Profiles interface {
	UserFetchByID(context.Context, *connect.Request[mdmpb.UserFetchByIDRequest]) (*connect.Response[mdmpb.UserFetchByIDResponse], error)
	UserFetchByUUID(context.Context, *connect.Request[mdmpb.UserFetchByUUIDRequest]) (*connect.Response[mdmpb.UserFetchByUUIDResponse], error)
}

// Renderer is the slice of the files service the journal needs.
type Renderer interface {
	FileGenerate(context.Context, *connect.Request[filespb.FileGenerateRequest]) (*connect.Response[filespb.FileGenerateResponse], error)
}

type Store interface {
	CertificateOrderCreate(ctx context.Context, o *models.CertificateOrder) error
	CertificateOrderFetch(ctx context.Context, status pb.CertificateOrderStatus) ([]*models.CertificateOrder, error)
	CertificateOrderByID(ctx context.Context, id int64) (*models.CertificateOrder, error)
	CertificateOrderMarkIssued(ctx context.Context, id int64, by string, at time.Time) error
}

type Service struct {
	log      *slog.Logger
	profiles Profiles
	files    Renderer
	store    Store // nil — journal unavailable (database down)
}

func NewService(log *slog.Logger, profiles Profiles, files Renderer, store Store) *Service {
	return &Service{log: log, profiles: profiles, files: files, store: store}
}

var errJournalUnavailable = connect.NewError(connect.CodeUnavailable, errors.New("журнал справок недоступен"))

// caller — the signed-in user's MDM id and name (who orders/issues).
func (s *Service) caller(ctx context.Context) (id int64, name string, user *auth.User, err error) {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return 0, "", nil, connect.NewError(connect.CodeUnauthenticated, errors.New("not signed in"))
	}
	resp, err := s.profiles.UserFetchByUUID(ctx, connect.NewRequest(&mdmpb.UserFetchByUUIDRequest{Uuid: user.UUID}))
	if err != nil {
		return 0, "", nil, connect.NewError(connect.CodeUnavailable, errors.New("не удалось найти вас в MDM"))
	}
	u := resp.Msg.GetUser()
	name = strings.TrimSpace(u.GetLastName() + " " + u.GetFirstName())
	if name == "" {
		name = user.Username
	}
	return u.GetId(), name, user, nil
}

// CertificateOrder: for oneself, or — with certificate.issue — for any
// student (then recorded as already issued). Business failures (no such
// student, rendering failed) come back in Success/Message, as before.
func (s *Service) CertificateOrder(ctx context.Context, req *pb.CertificateOrderRequest) (*pb.CertificateOrderResponse, error) {
	const op = "Certificate.CertificateOrder"
	log := s.log.With(slog.String("op", op), slog.Int64("user_id", req.GetUserId()), slog.Int("copies", int(req.GetCopies())))

	if !orderable[req.GetType()] {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("такой справки нет"))
	}
	copies := req.GetCopies()
	if copies < 1 || copies > maxCopies {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("число экземпляров — от 1 до 10"))
	}
	if s.store == nil {
		return nil, errJournalUnavailable
	}

	selfID, actor, user, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	studentID := req.GetUserId()
	if studentID == 0 {
		studentID = selfID
	}
	onBehalf := studentID != selfID
	if onBehalf && !user.Can(auth.SectionCertificate, auth.ActionPost) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("справку можно заказать только на себя"))
	}

	profile, resp := s.render(ctx, log, studentID, req.GetType())
	if resp != nil {
		return resp, nil
	}

	order := &models.CertificateOrder{
		StudentMdmID: studentID,
		StudentName:  fullName(profile.GetUser()),
		Type:         req.GetType(),
		Copies:       copies,
		Status:       pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ORDERED,
		OrderedBy:    actor,
	}
	if onBehalf {
		now := time.Now()
		order.Status = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ISSUED
		order.IssuedBy, order.IssuedAt = actor, &now
	}
	if err := s.store.CertificateOrderCreate(ctx, order); err != nil {
		log.Error("journal write failed", slog.String("error", err.Error()))
		return nil, errJournalUnavailable
	}

	log.Info("certificate ordered", slog.Int64("order_id", order.ID), slog.Bool("on_behalf", onBehalf))
	return &pb.CertificateOrderResponse{
		Success:  true,
		FileName: profile.fileName,
		Content:  profile.content,
	}, nil
}

func (s *Service) CertificateFetch(ctx context.Context, req *pb.CertificateFetchRequest) (*pb.CertificateFetchResponse, error) {
	if err := auth.RequireCan(ctx, auth.SectionCertificate, auth.ActionFetch); err != nil {
		return nil, err
	}
	if s.store == nil {
		return nil, errJournalUnavailable
	}
	orders, err := s.store.CertificateOrderFetch(ctx, req.GetStatus())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &pb.CertificateFetchResponse{}
	for _, o := range orders {
		resp.Orders = append(resp.Orders, o.ToProto())
	}
	return resp, nil
}

// CertificateIssue marks an order issued (the first issue sticks) and
// renders its document again, for printing.
func (s *Service) CertificateIssue(ctx context.Context, req *pb.CertificateIssueRequest) (*pb.CertificateIssueResponse, error) {
	const op = "Certificate.CertificateIssue"
	log := s.log.With(slog.String("op", op), slog.Int64("order_id", req.GetId()))

	if err := auth.RequireCan(ctx, auth.SectionCertificate, auth.ActionPost); err != nil {
		return nil, err
	}
	if s.store == nil {
		return nil, errJournalUnavailable
	}
	order, err := s.store.CertificateOrderByID(ctx, req.GetId())
	if errors.Is(err, models.ErrCertificateOrderNotFound) {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	_, actor, _, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}

	doc, failed := s.render(ctx, log, order.StudentMdmID, order.Type)
	if failed != nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New(failed.GetMessage()))
	}
	if err := s.store.CertificateOrderMarkIssued(ctx, order.ID, actor, time.Now()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if order, err = s.store.CertificateOrderByID(ctx, order.ID); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	log.Info("certificate issued", slog.String("by", actor))
	return &pb.CertificateIssueResponse{Order: order.ToProto(), FileName: doc.fileName, Content: doc.content}, nil
}

type renderedDoc struct {
	*entity.UserFull
	fileName string
	content  []byte
}

// render looks the student up in mdm and has the files service build the
// document. A business failure comes back as a ready response to return.
func (s *Service) render(ctx context.Context, log *slog.Logger, studentID int64, kind fileenum.FileGenerateType) (*renderedDoc, *pb.CertificateOrderResponse) {
	profileResp, err := s.profiles.UserFetchByID(ctx, connect.NewRequest(&mdmpb.UserFetchByIDRequest{Id: studentID}))
	if err != nil || profileResp.Msg.GetProfile().GetUser() == nil {
		log.Error("mdm profile lookup failed", slog.Any("error", err))
		return nil, &pb.CertificateOrderResponse{Message: "не удалось найти данные студента"}
	}
	profile := profileResp.Msg.GetProfile()

	genResp, err := s.files.FileGenerate(ctx, connect.NewRequest(&filespb.FileGenerateRequest{Profile: profile, Type: kind}))
	if err != nil {
		log.Error("file generation failed", slog.String("error", err.Error()))
		return nil, &pb.CertificateOrderResponse{Message: "не удалось сформировать документ"}
	}
	if !genResp.Msg.GetSuccess() {
		log.Warn("file generation reported failure", slog.String("message", genResp.Msg.GetMessage()))
		return nil, &pb.CertificateOrderResponse{Message: genResp.Msg.GetMessage()}
	}
	return &renderedDoc{UserFull: profile, fileName: genResp.Msg.GetFile().GetFileName(), content: genResp.Msg.GetContent()}, nil
}

func fullName(u *entity.User) string {
	return strings.TrimSpace(u.GetLastName() + " " + u.GetFirstName() + " " + u.GetPatronymic())
}
