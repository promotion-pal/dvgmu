// Package deanery — раздел «Деканат»: студенты своего факультета по группам и
// курсам и коды первого входа в личный кабинет (лист на группу для печати).
//
// Факультет студента — по зачётке, деканат сотрудника — подразделение в MDM
// (internal/faculty). ADMIN и сотрудник без подразделения-деканата видят всех.
//
// Код первого входа включает учётку AD при активации (auth /activate),
// поэтому модуль выдаёт его только студенту, который учится, со связанной
// учёткой AD и логином. Список студентов и проверки — на сервере, клиенту не
// верим. Открытые коды не пишутся в лог.
//
// Права: DeaneryStudentFetch — просмотр раздела, выдача кодов — deanery.post
// (интерцептор, Sections).
package deanery

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"sort"
	"strings"

	"connectrpc.com/connect"

	mdmentity "fesmu/contract/mdm/entity"
	mdmenum "fesmu/contract/mdm/enum"
	mdmpb "fesmu/contract/mdm/service"
	mdmconnect "fesmu/contract/mdm/service/serviceconnect"
	pb "fesmu/contract/fesmu/service/v1"
	serviceconnect "fesmu/contract/fesmu/service/v1/servicev1connect"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/faculty"
)

// MaxIssue — сколько кодов за один запрос (больше любой группы).
const MaxIssue = 200

// MDM — часть клиента MDM, нужная модулю.
type MDM interface {
	UserFetchByUUID(context.Context, *connect.Request[mdmpb.UserFetchByUUIDRequest]) (*connect.Response[mdmpb.UserFetchByUUIDResponse], error)
	StudentFetch(context.Context, *connect.Request[mdmpb.StudentFetchRequest]) (*connect.Response[mdmpb.StudentFetchResponse], error)
	ActivationIssue(context.Context, *connect.Request[mdmpb.ActivationIssueRequest]) (*connect.Response[mdmpb.ActivationIssueResponse], error)
}

type Module struct {
	log *slog.Logger
	mdm MDM // nil — MDM не настроен
}

// New: пустой url — модуль отвечает «недоступно», остальной api работает.
func New(log *slog.Logger, mdmURL string) *Module {
	m := &Module{log: log}
	if mdmURL != "" {
		m.mdm = mdmconnect.NewUserServiceClient(http.DefaultClient, mdmURL)
	}
	return m
}

// NewWithMDM — для тестов.
func NewWithMDM(log *slog.Logger, mdm MDM) *Module {
	return &Module{log: log, mdm: mdm}
}

func (m *Module) Mount(mux *http.ServeMux, opts ...connect.HandlerOption) []string {
	path, h := serviceconnect.NewDeaneryServiceHandler(m, opts...)
	mux.Handle(path, h)
	return []string{serviceconnect.DeaneryServiceName}
}

var errUnavailable = connect.NewError(connect.CodeUnavailable, errors.New("MDM недоступен"))

// scope — студентов каких факультетов видит сотрудник.
type scope struct {
	all       bool
	faculties map[int32]bool
}

func (sc scope) allows(code int32) bool { return sc.all || sc.faculties[code] }

func (sc scope) labels() []string {
	var out []string
	for _, code := range faculty.All {
		if sc.faculties[code] {
			out = append(out, faculty.Label(code))
		}
	}
	return out
}

// caller — кто вошёл и его факультеты: ADMIN или нет подразделения-деканата —
// все; иначе — факультеты его деканатов.
func (m *Module) caller(ctx context.Context) (*auth.User, scope, error) {
	user, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, scope{}, connect.NewError(connect.CodeUnauthenticated, errors.New("not signed in"))
	}
	if user.HasRole(auth.RoleAdmin) {
		return user, scope{all: true}, nil
	}
	resp, err := m.mdm.UserFetchByUUID(ctx, connect.NewRequest(&mdmpb.UserFetchByUUIDRequest{Uuid: user.UUID}))
	if err != nil {
		return nil, scope{}, connect.NewError(connect.CodeUnavailable, errors.New("не удалось найти вас в MDM"))
	}
	f := faculty.OfDepartments(resp.Msg.GetUser().GetDepartments())
	if len(f) == 0 {
		return user, scope{all: true}, nil
	}
	return user, scope{faculties: f}, nil
}

var studentStatusLabels = map[mdmenum.UserStudentStatus]string{
	mdmenum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING:       "Учится",
	mdmenum.UserStudentStatus_USER_STUDENT_STATUS_EXPELLED:       "Отчислен",
	mdmenum.UserStudentStatus_USER_STUDENT_STATUS_ACADEMIC_LEAVE: "Академический отпуск",
	mdmenum.UserStudentStatus_USER_STUDENT_STATUS_RESTORED:       "Восстановлен",
	mdmenum.UserStudentStatus_USER_STUDENT_STATUS_GRADUATED:      "Выпустился",
	mdmenum.UserStudentStatus_USER_STUDENT_STATUS_TRANSFERRED:    "Переведён",
}

func fullName(u *mdmentity.User) string {
	parts := []string{u.GetLastName(), u.GetFirstName(), u.GetPatronymic()}
	var out []string
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return strings.Join(out, " ")
}

// issueBlocker — почему нельзя выдать код; "" — можно.
func issueBlocker(s *mdmentity.Student, u *mdmentity.User) string {
	switch {
	case u.GetStatus() == mdmenum.UserStatus_USER_STATUS_INACTIVE:
		return "учётка отключена в MDM"
	case strings.TrimSpace(u.GetAdObjectId()) == "":
		return "нет учётки AD"
	case strings.TrimSpace(u.GetUsername()) == "":
		return "нет логина"
	}
	switch s.GetStatus() {
	case mdmenum.UserStudentStatus_USER_STUDENT_STATUS_STUDYING, mdmenum.UserStudentStatus_USER_STUDENT_STATUS_RESTORED:
		return ""
	}
	if l := studentStatusLabels[s.GetStatus()]; l != "" {
		return "статус: " + l
	}
	return "статус не указан"
}

func toStudent(sw *mdmpb.StudentWithUser, code int32) *pb.DeaneryStudent {
	s, u := sw.GetStudent(), sw.GetUser()
	blocker := issueBlocker(s, u)
	return &pb.DeaneryStudent{
		UserId:       u.GetId(),
		FullName:     fullName(u),
		Group:        strings.TrimSpace(s.GetGroup()),
		Course:       faculty.Course(s.GetGroup()),
		Faculty:      faculty.Label(code),
		RecordBook:   strings.TrimSpace(s.GetRecordBook()),
		Login:        strings.TrimSpace(u.GetUsername()),
		HasAccount:   strings.TrimSpace(u.GetAdObjectId()) != "",
		Status:       studentStatusLabels[s.GetStatus()],
		CanIssue:     blocker == "",
		IssueBlocker: blocker,
	}
}

// students — студенты в пределах sc, по группе и ФИО. У студента может быть
// несколько записей (перевод) — берём одну на человека, первую подходящую
// под выдачу кода.
func (m *Module) students(ctx context.Context, sc scope) ([]*pb.DeaneryStudent, error) {
	resp, err := m.mdm.StudentFetch(ctx, connect.NewRequest(&mdmpb.StudentFetchRequest{}))
	if err != nil {
		m.log.Error("deanery: mdm student fetch failed", slog.String("error", err.Error()))
		return nil, errUnavailable
	}
	byUser := map[int64]*pb.DeaneryStudent{}
	for _, sw := range resp.Msg.GetStudents() {
		if sw.GetStudent() == nil || sw.GetUser() == nil || sw.GetUser().GetId() == 0 {
			continue
		}
		code := faculty.FromRecordBook(sw.GetStudent().GetRecordBook())
		if !sc.allows(code) {
			continue
		}
		st := toStudent(sw, code)
		if prev, ok := byUser[st.UserId]; ok && (prev.CanIssue || !st.CanIssue) {
			continue
		}
		byUser[st.UserId] = st
	}
	out := make([]*pb.DeaneryStudent, 0, len(byUser))
	for _, st := range byUser {
		out = append(out, st)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Group != out[j].Group {
			return out[i].Group < out[j].Group
		}
		return out[i].FullName < out[j].FullName
	})
	return out, nil
}

func (m *Module) DeaneryStudentFetch(ctx context.Context, _ *connect.Request[pb.DeaneryStudentFetchRequest]) (*connect.Response[pb.DeaneryStudentFetchResponse], error) {
	if m.mdm == nil {
		return nil, errUnavailable
	}
	_, sc, err := m.caller(ctx)
	if err != nil {
		return nil, err
	}
	list, err := m.students(ctx, sc)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(&pb.DeaneryStudentFetchResponse{
		Students:     list,
		Faculties:    sc.labels(),
		AllFaculties: sc.all,
	}), nil
}

func (m *Module) DeaneryActivationIssue(ctx context.Context, req *connect.Request[pb.DeaneryActivationIssueRequest]) (*connect.Response[pb.DeaneryActivationIssueResponse], error) {
	if m.mdm == nil {
		return nil, errUnavailable
	}
	ids := dedup(req.Msg.GetUserIds())
	if len(ids) == 0 {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("выберите студентов"))
	}
	if len(ids) > MaxIssue {
		return nil, connect.NewError(connect.CodeInvalidArgument, errors.New("за раз — не больше 200 студентов"))
	}
	me, sc, err := m.caller(ctx)
	if err != nil {
		return nil, err
	}
	list, err := m.students(ctx, sc)
	if err != nil {
		return nil, err
	}
	known := make(map[int64]*pb.DeaneryStudent, len(list))
	for _, st := range list {
		known[st.UserId] = st
	}

	res := &pb.DeaneryActivationIssueResponse{}
	issued := 0
	for _, id := range ids {
		st, ok := known[id]
		if !ok {
			res.Codes = append(res.Codes, &pb.DeaneryActivationCode{UserId: id, Error: "студент не найден на вашем факультете"})
			continue
		}
		out := &pb.DeaneryActivationCode{UserId: id, FullName: st.FullName, Group: st.Group, Login: st.Login}
		if !st.CanIssue {
			out.Error = st.IssueBlocker
			res.Codes = append(res.Codes, out)
			continue
		}
		code, err := m.mdm.ActivationIssue(ctx, connect.NewRequest(&mdmpb.ActivationIssueRequest{Id: id}))
		if err != nil {
			m.log.Warn("deanery: activation issue failed", slog.Int64("user_id", id), slog.String("error", err.Error()))
			out.Error = "MDM не выдал код, повторите позже"
		} else {
			out.Code = code.Msg.GetCode()
			out.ExpiresAt = code.Msg.GetExpiresAt()
			issued++
		}
		res.Codes = append(res.Codes, out)
	}
	m.log.Info("deanery: activation codes issued",
		slog.String("by", me.Username), slog.Int("requested", len(ids)), slog.Int("issued", issued))
	return connect.NewResponse(res), nil
}

func dedup(ids []int64) []int64 {
	seen := make(map[int64]bool, len(ids))
	out := make([]int64, 0, len(ids))
	for _, id := range ids {
		if id > 0 && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}
