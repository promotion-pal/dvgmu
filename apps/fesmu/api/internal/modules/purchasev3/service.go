package purchasev3

import (
	"context"
	"log/slog"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	entity "fesmu/contract/fesmu/entity/v3"
	enum "fesmu/contract/fesmu/enum/v3"
	pb "fesmu/contract/fesmu/service/v3"
	"dvgmu/api/internal/modules/purchase"
)

const (
	maxFileSize = 20 << 20
	maxQuantity = 1e9
	defaultUnit = "шт."
	serviceUnit = "усл."
)

const (
	logRequest  = enum.PurchaseLogTarget_PURCHASE_LOG_TARGET_REQUEST
	logLot      = enum.PurchaseLogTarget_PURCHASE_LOG_TARGET_LOT
	logProtocol = enum.PurchaseLogTarget_PURCHASE_LOG_TARGET_PROTOCOL
)

// Service holds the purchase v3 use cases. store is nil while purchase_db is
// unreachable; every call then answers ErrUnavailable. profiles is nil
// without MDM: users then have no department.
type Service struct {
	log      *slog.Logger
	store    *storage
	profiles *profileCache
	now      func() time.Time
}

func newService(log *slog.Logger, store *storage, profiles purchase.Profiles) *Service {
	return &Service{log: log, store: store, profiles: newProfileCache(profiles), now: time.Now}
}

func (s *Service) ready() error {
	if s.store == nil {
		return ErrUnavailable
	}
	return nil
}

// begin is the start of every call: the database is up and the user is known.
func (s *Service) begin(ctx context.Context) (actor, error) {
	if err := s.ready(); err != nil {
		return actor{}, err
	}
	return s.actorOf(ctx)
}

// logAs writes what a did in role.
func (a actor) logAs(role enum.PurchaseRole, target enum.PurchaseLogTarget, id int64, action, text, comment string, at time.Time) *Log {
	return &Log{
		Target: target, TargetID: id, Role: role,
		ActorName: a.name, ActorUUID: a.uuid,
		Action: action, Text: cut(text, 4096), Comment: cut(strings.TrimSpace(comment), 4096),
		CreatedAt: at,
	}
}

func (a actor) signOff(role enum.PurchaseRole, status int32, comment string, at time.Time) SignOff {
	return SignOff{Role: role, Stage: status, Name: a.name, UUID: a.uuid, Comment: cut(strings.TrimSpace(comment), 2048), At: at}
}

func cut(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

func tooLong(s string, n int) bool { return utf8.RuneCountInString(s) > n }

// fileName is the base name of an uploaded file, without any path.
func fileName(name, fallback string) string {
	name = strings.TrimSpace(filepath.Base(strings.ReplaceAll(name, "\\", "/")))
	if name == "." || name == "/" || name == "" {
		name = fallback
	}
	return cut(name, 255)
}

// suggestDepartment is the implementing department for a title: the
// category whose ОКПД2 prefix matches the guessed code the longest.
func suggestDepartment(categories []*Category, title string) int32 {
	code, _ := purchase.Classify(title)
	if code == "" {
		return 0
	}
	var best *Category
	for _, c := range categories {
		if strings.HasPrefix(code, c.Okpd2Prefix) && (best == nil || len(c.Okpd2Prefix) > len(best.Okpd2Prefix)) {
			best = c
		}
	}
	if best == nil {
		return 0
	}
	return best.ImplementingDepartment
}

// departmentName is a department's name from the directory, or its number.
func departmentName(ctx context.Context, st *storage, id int32) string {
	if id == 0 {
		return "не указан"
	}
	if d, err := st.department(ctx, id); err == nil {
		return d.Name
	}
	return "#" + strconv.Itoa(int(id))
}

// curatorOfDepartment is the direction the directory puts the department in.
func curatorOfDepartment(ctx context.Context, st *storage, id int32) (int64, error) {
	d, err := st.department(ctx, id)
	if err != nil {
		return 0, err
	}
	if d.CuratorID == nil {
		return 0, invalid("отдел «%s» не отнесён к направлению проректора — обратитесь к администратору", d.Name)
	}
	return *d.CuratorID, nil
}

// directionOf is the vice-rector direction for a department: the directory's,
// or — for an administrator, who is not held up by an unfilled directory —
// the one picked.
func directionOf(ctx context.Context, st *storage, a actor, department int32, picked int64) (int64, error) {
	if picked != 0 {
		if !a.admin {
			return 0, forbidden("направление берётся из справочника — выбрать его может только администратор")
		}
		if _, err := st.curator(ctx, picked); err != nil {
			return 0, err
		}
		return picked, nil
	}
	id, err := curatorOfDepartment(ctx, st, department)
	if err != nil && a.admin {
		return 0, invalid("%s; как администратор вы можете выбрать направление в карточке", err.Error())
	}
	return id, err
}

// ── Overview ────────────────────────────────────────────────────────────

func (s *Service) Overview(ctx context.Context, planYear int32, visit bool) (*pb.PurchaseOverviewFetchResponse, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	if !a.anyPerm() {
		return nil, forbidden("нет доступа к закупкам — обратитесь к администратору")
	}
	// A visit that is not recorded must not keep the page from opening.
	if visit && a.uuid != "" {
		if err := s.store.addVisit(ctx, &Visit{UserUUID: a.uuid, UserName: a.name, CreatedAt: s.now()}); err != nil {
			s.log.WarnContext(ctx, "purchase v3: visit", "err", err)
		}
	}
	curators, err := s.store.curators(ctx)
	if err != nil {
		return nil, err
	}
	departments, err := s.store.departments(ctx)
	if err != nil {
		return nil, err
	}
	categories, err := s.store.categories(ctx)
	if err != nil {
		return nil, err
	}
	requests, err := s.store.requests(ctx)
	if err != nil {
		return nil, err
	}
	lots, err := s.store.lots(ctx)
	if err != nil {
		return nil, err
	}
	logs, err := s.store.logs(ctx)
	if err != nil {
		return nil, err
	}

	v := a.viewer(departments)
	requests, lots = v.visible(requests, lots)
	// A plan year keeps the purchases of that year and everything not yet
	// before the commission.
	if planYear != 0 {
		lots = slices.DeleteFunc(lots, func(l *Lot) bool { return l.PlanYear != 0 && l.PlanYear != planYear })
	}

	type key struct {
		target enum.PurchaseLogTarget
		id     int64
	}
	logsOf := map[key][]*Log{}
	for _, l := range logs {
		k := key{l.Target, l.TargetID}
		logsOf[k] = append(logsOf[k], l)
	}

	resp := &pb.PurchaseOverviewFetchResponse{}
	lotRequests := map[int64][]int64{}
	for _, r := range requests {
		if r.LotID != nil {
			lotRequests[*r.LotID] = append(lotRequests[*r.LotID], r.ID)
		}
		resp.Requests = append(resp.Requests,
			r.ToProto(logsOf[key{logRequest, r.ID}], a.allowedRequest(r), suggestDepartment(categories, r.Title)))
	}
	for _, l := range lots {
		ids := lotRequests[l.ID]
		slices.Sort(ids)
		resp.Lots = append(resp.Lots, l.ToProto(ids, logsOf[key{logLot, l.ID}], a.allowedLot(l)))
	}
	if v.plan {
		protocols, err := s.store.protocols(ctx)
		if err != nil {
			return nil, err
		}
		for _, p := range protocols {
			resp.Protocols = append(resp.Protocols, p.ToProto())
		}
	}
	for _, c := range curators {
		resp.Curators = append(resp.Curators, c.ToProto())
	}
	for _, d := range departments {
		resp.Departments = append(resp.Departments, d.ToProto())
	}
	for _, c := range categories {
		resp.Categories = append(resp.Categories, c.ToProto())
	}
	me := &entity.PurchaseMe{Uuid: a.uuid, Name: a.name, Position: a.position, CuratorIds: a.curators, Permissions: a.permList(), Admin: a.admin}
	for _, d := range a.departments {
		me.Departments = append(me.Departments, dep(d))
	}
	resp.Me = me
	return resp, nil
}

// EmployeeFetch lists MDM employees of department (0 — all), one line each.
func (s *Service) EmployeeFetch(ctx context.Context, department int32) ([]*entity.PurchaseEmployee, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	if !a.can(permLotManage) && !a.can(permDirectories) {
		return nil, needPerm(permLotManage)
	}
	if s.profiles == nil {
		return nil, ErrUnavailable
	}
	list, err := s.profiles.Employees(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*entity.PurchaseEmployee, 0, len(list))
	seen := map[string]bool{}
	for _, e := range list {
		if department != 0 && e.Department != department || seen[e.UUID] {
			continue
		}
		seen[e.UUID] = true
		out = append(out, &entity.PurchaseEmployee{Uuid: e.UUID, Name: e.Name, Department: dep(e.Department)})
	}
	slices.SortFunc(out, func(a, b *entity.PurchaseEmployee) int { return strings.Compare(a.Name, b.Name) })
	return out, nil
}

// employeeName is the MDM name of uuid, if they are in department.
func (s *Service) employeeName(ctx context.Context, uuid string, department int32) (string, error) {
	list, err := s.profiles.Employees(ctx)
	if err != nil {
		return "", err
	}
	for _, e := range list {
		if e.UUID == uuid && e.Department == department {
			return e.Name, nil
		}
	}
	return "", invalid("исполнитель должен быть сотрудником реализующего отдела")
}

func (s *Service) CodeSuggest(ctx context.Context, title string) (*entity.PurchaseCodeSuggestion, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	okpd2, name := purchase.Classify(title)
	if okpd2 == "" {
		return &entity.PurchaseCodeSuggestion{}, nil
	}
	categories, err := s.store.categories(ctx)
	if err != nil {
		return nil, err
	}
	return &entity.PurchaseCodeSuggestion{
		Found: true, Okpd2: okpd2, Ktru: okpd2, Okved: purchase.OkvedOf(okpd2), Name: name,
		ImplementingDepartment: dep(suggestDepartment(categories, title)),
	}, nil
}
