// Package certificate — справки студентов: заказ, журнал деканата, печать и
// выдача. Профиль студента берётся из mdm по id, документ рисует сервис files;
// каждый заказ — строка журнала (certificate_orders).
//
// Путь справки: студент заказывает (ORDERED) → деканат его факультета печатает
// (READY) → студент расписывается и забирает (ISSUED); деканат может отклонить
// (CANCELLED). Студент файл не получает, только видит статус.
package certificate

import (
	"dvgmu/api/internal/faculty"

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

const (
	maxCopies       = 10
	maxReasonLength = 500
)

const (
	statusOrdered   = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ORDERED
	statusIssued    = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ISSUED
	statusCancelled = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_CANCELLED
)

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
	CertificateOrderFetchByStudent(ctx context.Context, studentID int64) ([]*models.CertificateOrder, error)
	CertificateOrderByID(ctx context.Context, id int64) (*models.CertificateOrder, error)
	CertificateOrderSetFaculty(ctx context.Context, id int64, faculty int32, group, recordBook string) error
	CertificateOrderMarkReady(ctx context.Context, id int64, by string, at time.Time) error
	CertificateOrderMarkIssued(ctx context.Context, id int64, by string, at time.Time) error
	CertificateOrderCancel(ctx context.Context, id int64, reason, by string) error
}

type Service struct {
	log      *slog.Logger
	profiles Profiles
	files    Renderer
	store    Store // nil — journal unavailable (database down)
	now      func() time.Time
}

func NewService(log *slog.Logger, profiles Profiles, files Renderer, store Store) *Service {
	return &Service{log: log, profiles: profiles, files: files, store: store, now: time.Now}
}

var (
	errJournalUnavailable = connect.NewError(connect.CodeUnavailable, errors.New("журнал справок недоступен"))
	errNotYourFaculty     = connect.NewError(connect.CodePermissionDenied, errors.New("заказ студента другого факультета"))
)

// actor — кто вошёл: его запись в MDM (id, ФИО, подразделения) и токен.
type actor struct {
	id    int64
	name  string
	mdm   *entity.User
	token *auth.User
}

func (s *Service) caller(ctx context.Context) (*actor, error) {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("not signed in"))
	}
	resp, err := s.profiles.UserFetchByUUID(ctx, connect.NewRequest(&mdmpb.UserFetchByUUIDRequest{Uuid: user.UUID}))
	if err != nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New("не удалось найти вас в MDM"))
	}
	u := resp.Msg.GetUser()
	name := strings.TrimSpace(u.GetLastName() + " " + u.GetFirstName())
	if name == "" {
		name = user.Username
	}
	return &actor{id: u.GetId(), name: name, mdm: u, token: user}, nil
}

// scope — чьи заказы видит и обрабатывает сотрудник: факультеты его
// деканатов. ADMIN и сотрудник без подразделения-деканата — все факультеты.
type scope struct {
	all       bool
	faculties map[int32]bool
}

func (a *actor) scope() scope {
	if a.token.HasRole(auth.RoleAdmin) {
		return scope{all: true}
	}
	f := faculty.OfDepartments(a.mdm.GetDepartments())
	if len(f) == 0 {
		return scope{all: true}
	}
	return scope{faculties: f}
}

// Заказ с неопределённым факультетом видят только «все факультеты»: деканат
// его не получит, его обрабатывает сотрудник без привязки к деканату.
func (sc scope) allows(faculty int32) bool { return sc.all || sc.faculties[faculty] }

func (sc scope) labels() []string {
	var out []string
	for _, code := range faculty.All {
		if sc.faculties[code] {
			out = append(out, faculty.Label(code))
		}
	}
	return out
}

// CertificateOrder: на себя — заказ без файла, ждёт деканат. С certificate.post
// за любого студента — сразу выдана, файл в ответе (как раньше).
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

	me, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	studentID := req.GetUserId()
	if studentID == 0 {
		studentID = me.id
	}
	onBehalf := studentID != me.id
	if onBehalf && !me.token.Can(auth.SectionCertificate, auth.ActionPost) {
		return nil, connect.NewError(connect.CodePermissionDenied, errors.New("справку можно заказать только на себя"))
	}

	order := &models.CertificateOrder{
		StudentMdmID: studentID,
		Type:         req.GetType(),
		Copies:       copies,
		Status:       statusOrdered,
		OrderedBy:    me.name,
	}

	var doc *renderedDoc
	if onBehalf {
		// За студента — документ сразу: проверяет и данные, и шаблон.
		var failed *pb.CertificateOrderResponse
		if doc, failed = s.render(ctx, log, studentID, req.GetType()); failed != nil {
			return failed, nil
		}
		fillStudent(order, doc.UserFull)
		now := s.now()
		order.Status = statusIssued
		order.IssuedBy, order.IssuedAt = me.name, &now
	} else {
		// На себя — только профиль: документ напечатает деканат.
		profile, err := s.profile(ctx, studentID)
		if err != nil {
			log.Error("mdm profile lookup failed", slog.String("error", err.Error()))
			return &pb.CertificateOrderResponse{Message: "не удалось найти ваши данные студента"}, nil
		}
		fillStudent(order, profile)
	}

	if err := s.store.CertificateOrderCreate(ctx, order); err != nil {
		log.Error("journal write failed", slog.String("error", err.Error()))
		return nil, errJournalUnavailable
	}

	log.Info("certificate ordered", slog.Int64("order_id", order.ID), slog.Bool("on_behalf", onBehalf), slog.Int("faculty", int(order.FacultyCode)))
	resp := &pb.CertificateOrderResponse{Success: true}
	if doc != nil {
		resp.FileName, resp.Content = doc.fileName, doc.content
	} else {
		resp.Message = "Заказ принят. Деканат подготовит справку — статус виден в кабинете."
	}
	return resp, nil
}

// CertificateMyFetch — свои заказы студента, новые сверху.
func (s *Service) CertificateMyFetch(ctx context.Context, _ *pb.CertificateMyFetchRequest) (*pb.CertificateFetchResponse, error) {
	if s.store == nil {
		return nil, errJournalUnavailable
	}
	me, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	orders, err := s.store.CertificateOrderFetchByStudent(ctx, me.id)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &pb.CertificateFetchResponse{}
	for _, o := range orders {
		resp.Orders = append(resp.Orders, o.ToProto(faculty.Label))
	}
	return resp, nil
}

// CertificateFetch — журнал деканата: только заказы своих факультетов.
func (s *Service) CertificateFetch(ctx context.Context, req *pb.CertificateFetchRequest) (*pb.CertificateFetchResponse, error) {
	if err := auth.RequireCan(ctx, auth.SectionCertificate, auth.ActionFetch); err != nil {
		return nil, err
	}
	if s.store == nil {
		return nil, errJournalUnavailable
	}
	me, err := s.caller(ctx)
	if err != nil {
		return nil, err
	}
	sc := me.scope()

	orders, err := s.store.CertificateOrderFetch(ctx, req.GetStatus())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	resp := &pb.CertificateFetchResponse{AllFaculties: sc.all, Faculties: sc.labels()}
	for _, o := range orders {
		s.backfillFaculty(ctx, o)
		if sc.allows(o.FacultyCode) {
			resp.Orders = append(resp.Orders, o.ToProto(faculty.Label))
		}
	}
	return resp, nil
}

// CertificatePrint — документ для печати; «заказана» → «готова к выдаче».
// Перепечатка готовой или выданной статус не меняет.
func (s *Service) CertificatePrint(ctx context.Context, req *pb.CertificatePrintRequest) (*pb.CertificatePrintResponse, error) {
	const op = "Certificate.CertificatePrint"
	log := s.log.With(slog.String("op", op), slog.Int64("order_id", req.GetId()))

	order, me, err := s.ownOrder(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	if order.Status == statusCancelled {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("заказ отклонён — печатать нечего"))
	}
	doc, failed := s.render(ctx, log, order.StudentMdmID, order.Type)
	if failed != nil {
		return nil, connect.NewError(connect.CodeUnavailable, errors.New(failed.GetMessage()))
	}
	if err := s.store.CertificateOrderMarkReady(ctx, order.ID, me.name, s.now()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if order, err = s.store.CertificateOrderByID(ctx, order.ID); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	log.Info("certificate printed", slog.String("by", me.name))
	return &pb.CertificatePrintResponse{Order: order.ToProto(faculty.Label), FileName: doc.fileName, Content: doc.content}, nil
}

// CertificateIssue — студент расписался и забрал справку.
func (s *Service) CertificateIssue(ctx context.Context, req *pb.CertificateIssueRequest) (*pb.CertificateIssueResponse, error) {
	order, me, err := s.ownOrder(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	if order.Status == statusCancelled {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("заказ отклонён"))
	}
	if err := s.store.CertificateOrderMarkIssued(ctx, order.ID, me.name, s.now()); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if order, err = s.store.CertificateOrderByID(ctx, order.ID); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	s.log.Info("certificate issued", slog.Int64("order_id", order.ID), slog.String("by", me.name))
	return &pb.CertificateIssueResponse{Order: order.ToProto(faculty.Label)}, nil
}

// CertificateCancel — отклонить заказ; причину видит студент.
func (s *Service) CertificateCancel(ctx context.Context, req *pb.CertificateCancelRequest) (*pb.CertificateCancelResponse, error) {
	reason := strings.TrimSpace(req.GetReason())
	if reason == "" {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("укажите причину — её увидит студент"))
	}
	if len([]rune(reason)) > maxReasonLength {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("причина — не длиннее 500 символов"))
	}
	order, me, err := s.ownOrder(ctx, req.GetId())
	if err != nil {
		return nil, err
	}
	if order.Status == statusIssued {
		return nil, connect.NewError(connect.CodeFailedPrecondition, errors.New("справка уже выдана"))
	}
	if err := s.store.CertificateOrderCancel(ctx, order.ID, reason, me.name); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	if order, err = s.store.CertificateOrderByID(ctx, order.ID); err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}
	s.log.Info("certificate cancelled", slog.Int64("order_id", order.ID), slog.String("by", me.name))
	return &pb.CertificateCancelResponse{Order: order.ToProto(faculty.Label)}, nil
}

// ownOrder — заказ, который сотрудник с certificate.post вправе обрабатывать:
// студент его факультета (или все факультеты).
func (s *Service) ownOrder(ctx context.Context, id int64) (*models.CertificateOrder, *actor, error) {
	if err := auth.RequireCan(ctx, auth.SectionCertificate, auth.ActionPost); err != nil {
		return nil, nil, err
	}
	if s.store == nil {
		return nil, nil, errJournalUnavailable
	}
	order, err := s.store.CertificateOrderByID(ctx, id)
	if errors.Is(err, models.ErrCertificateOrderNotFound) {
		return nil, nil, connect.NewError(connect.CodeNotFound, err)
	}
	if err != nil {
		return nil, nil, connect.NewError(connect.CodeInternal, err)
	}
	me, err := s.caller(ctx)
	if err != nil {
		return nil, nil, err
	}
	s.backfillFaculty(ctx, order)
	if !me.scope().allows(order.FacultyCode) {
		return nil, nil, errNotYourFaculty
	}
	return order, me, nil
}

// backfillFaculty — заказы, заведённые до учёта факультета: берём зачётку из
// MDM один раз и сохраняем. Не вышло — заказ остаётся «факультет не определён».
func (s *Service) backfillFaculty(ctx context.Context, o *models.CertificateOrder) {
	if o.FacultyCode != faculty.Unknown || o.RecordBook != "" {
		return
	}
	profile, err := s.profile(ctx, o.StudentMdmID)
	if err != nil {
		return
	}
	fillStudent(o, profile)
	if o.RecordBook == "" {
		return
	}
	if err := s.store.CertificateOrderSetFaculty(ctx, o.ID, o.FacultyCode, o.Group, o.RecordBook); err != nil {
		s.log.Warn("certificate: faculty backfill failed", slog.Int64("order_id", o.ID), slog.String("error", err.Error()))
	}
}

// fillStudent — ФИО, группа, зачётка и факультет студента в заказ.
func fillStudent(o *models.CertificateOrder, profile *entity.UserFull) {
	o.StudentName = fullName(profile.GetUser())
	st := profile.GetStudent()
	o.Group = st.GetGroup()
	o.RecordBook = st.GetRecordBook()
	o.FacultyCode = faculty.FromRecordBook(o.RecordBook)
}

func (s *Service) profile(ctx context.Context, studentID int64) (*entity.UserFull, error) {
	resp, err := s.profiles.UserFetchByID(ctx, connect.NewRequest(&mdmpb.UserFetchByIDRequest{Id: studentID}))
	if err != nil {
		return nil, err
	}
	if resp.Msg.GetProfile().GetUser() == nil {
		return nil, errors.New("empty profile")
	}
	return resp.Msg.GetProfile(), nil
}

type renderedDoc struct {
	*entity.UserFull
	fileName string
	content  []byte
}

// render looks the student up in mdm and has the files service build the
// document. A business failure comes back as a ready response to return.
func (s *Service) render(ctx context.Context, log *slog.Logger, studentID int64, kind fileenum.FileGenerateType) (*renderedDoc, *pb.CertificateOrderResponse) {
	profile, err := s.profile(ctx, studentID)
	if err != nil {
		log.Error("mdm profile lookup failed", slog.Any("error", err))
		return nil, &pb.CertificateOrderResponse{Message: "не удалось найти данные студента"}
	}

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
