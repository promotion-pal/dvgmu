package purchasev3

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"
	"time"

	"connectrpc.com/connect"

	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/modules/purchase"
	entity "fesmu/contract/fesmu/entity/v3"
	enum "fesmu/contract/fesmu/enum/v3"
)

// Rights are "purchase.<name>" strings in the token (Администрирование →
// Доступы); ADMIN has all. A right says WHAT the user may do; WHOSE records
// follows from the user: MDM departments, the vice-rector directions bound
// to them in the directory, purchases given to them.

// permCode is the right's string: VIEW_DIRECTION → "purchase.view_direction".
func permCode(p enum.PurchasePermission) string {
	return "purchase." + strings.ToLower(strings.TrimPrefix(p.String(), "PURCHASE_PERMISSION_"))
}

// permLabel names a right as the «Доступы» window does, for error messages.
var permLabel = map[enum.PurchasePermission]string{
	permViewDepartment: "Просмотр закупок своего отдела",
	permViewDirection:  "Просмотр общих страниц закупок проректором",
	permViewAll:        "Просмотр всех закупок университета",
	permViewPlan:       "Просмотр ПФХД и протоколов",
	permViewActivity:   "Статистика работы сотрудников",
	permRequestCreate:  "Подача заявки на закупку",
	permHeadReview:     "Согласование заявок отдела начальником",
	permRequestCurator: "Согласование заявок проректором",
	permLotManage:      "Ведение закупок реализующим отделом",
	permLotPrepare:     "Подготовка закупки исполнителем",
	permLotCurator:     "Согласование закупок проректором",
	permEconomist:      "Экономическая экспертиза",
	permCommission:     "Бюджетная комиссия",
	permContract:       "Контрактная служба",
	permProcurement:    "Проведение закупки отделом закупок",
	permAcceptance:     "Приёмка",
	permInventory:      "Постановка на учёт в инвентаре",
	permDirectories:    "Справочники закупок",
	permLotFullEdit:    "Полное редактирование закупок",
}

// allPerms lists every right, in enum order.
func allPerms() []enum.PurchasePermission {
	out := make([]enum.PurchasePermission, 0, len(permLabel))
	for p := range permLabel {
		out = append(out, p)
	}
	slices.Sort(out)
	return out
}

// actor is the signed-in user as the flow sees them.
type actor struct {
	uuid, name string
	// Job title from MDM, shown to the user; it grants nothing.
	position    string
	departments []int32
	// Vice-rector directions bound to the user.
	curators []int64
	perms    map[enum.PurchasePermission]bool
	admin    bool
}

func (a actor) can(p enum.PurchasePermission) bool { return a.admin || a.perms[p] }

// anyPerm: the user has something to do with purchases at all.
func (a actor) anyPerm() bool { return a.admin || len(a.perms) > 0 }

func (a actor) inDepartment(d int32) bool {
	return a.admin || d != 0 && slices.Contains(a.departments, d)
}

func (a actor) curates(id int64) bool {
	return a.admin || id != 0 && slices.Contains(a.curators, id)
}

func (a actor) is(uuid string) bool { return a.admin || uuid != "" && uuid == a.uuid }

func (a actor) permList() []enum.PurchasePermission {
	if a.admin {
		return allPerms()
	}
	out := make([]enum.PurchasePermission, 0, len(a.perms))
	for p := range a.perms {
		out = append(out, p)
	}
	slices.Sort(out)
	return out
}

func needPerm(p enum.PurchasePermission) error {
	return forbidden("нужен доступ «%s» — обратитесь к администратору", permLabel[p])
}

// mayRequest: the user holds the stage's right and the request is theirs to act on.
func (a actor) mayRequest(st stage[enum.PurchaseRequestStatus], r *Request) error {
	if !a.can(st.perm) {
		return needPerm(st.perm)
	}
	switch st.scope {
	case scopeAuthor:
		if !a.is(r.AuthorUUID) {
			return forbidden("это заявка другого сотрудника")
		}
	case scopeDepartment:
		if !a.inDepartment(r.Department) {
			return forbidden("заявка другого отдела — её рассматривает начальник того отдела")
		}
	case scopeCurator:
		if !a.curates(idOf(r.CuratorID)) {
			return forbidden("заявку рассматривает проректор другого направления")
		}
	case scopeImplementing:
		if !a.inDepartment(r.ImplementingDepartment) {
			return forbidden("заявка направлена в другой реализующий отдел")
		}
	}
	return nil
}

// mayLot: the user holds the stage's right and the purchase is theirs to act on.
func (a actor) mayLot(st stage[enum.PurchaseLotStatus], l *Lot) error {
	if !a.can(st.perm) {
		return needPerm(st.perm)
	}
	switch st.scope {
	case scopeImplementing:
		if !a.inDepartment(l.ImplementingDepartment) {
			return forbidden("закупку ведёт другой реализующий отдел")
		}
	case scopeCurator:
		if !a.curates(l.CuratorID) {
			return forbidden("закупку согласует проректор другого направления")
		}
	case scopeAssignee:
		if !a.is(l.AssigneeUUID) {
			return forbidden("закупка поручена другому исполнителю")
		}
	}
	return nil
}

// actingOnLot is the stage the purchase is at, if the user may act there.
func (a actor) actingOnLot(l *Lot) (stage[enum.PurchaseLotStatus], error) {
	st, _, ok := stageOf(lotRoute, l.Status)
	if !ok {
		if a.can(permLotFullEdit) {
			return stage[enum.PurchaseLotStatus]{role: roleImplementerHead}, nil
		}
		return st, wrongState("закупка %s — на этом этапе с ней ничего не делают", lotStatusLabel[l.Status])
	}
	if a.can(permLotFullEdit) {
		return st, nil
	}
	return st, a.mayLot(st, l)
}

// allowedRequest is what the user may do with the request now.
func (a actor) allowedRequest(r *Request) *entity.PurchaseAllowed {
	out := &entity.PurchaseAllowed{}
	if (r.Status == reqHeadReview || r.Status == reqRework) && a.can(permRequestCreate) && a.is(r.AuthorUUID) {
		out.Remove = true
	}
	st, _, ok := stageOf(requestRoute, r.Status)
	if !ok || a.mayRequest(st, r) != nil {
		return out
	}
	if st.next != 0 {
		out.Moves = append(out.Moves, moveForward)
	}
	if st.prev != 0 {
		out.Moves = append(out.Moves, moveReturn)
	}
	if st.reject {
		out.Moves = append(out.Moves, moveReject)
	}
	out.Edit = r.Status == reqRework || r.Status == reqHeadReview
	out.Mine = a.own().mayRequest(st, r) == nil
	return out
}

// allowedLot is what the user may do with the purchase now.
func (a actor) allowedLot(l *Lot) *entity.PurchaseAllowed {
	out := &entity.PurchaseAllowed{}
	if a.can(permLotFullEdit) {
		out.Edit, out.Mine = true, true
		return out
	}
	st, err := a.actingOnLot(l)
	if err != nil {
		return out
	}
	if nextLot(l, st) != 0 {
		out.Moves = append(out.Moves, moveForward)
	}
	if st.prev != 0 {
		out.Moves = append(out.Moves, moveReturn)
	}
	out.Edit = l.Status != lotCommission
	out.Remove = l.Status == lotForming
	out.Mine = a.own().mayLot(st, l) == nil
	return out
}

// own is the user without the administrator's powers: what is theirs by
// their rights, department and direction.
func (a actor) own() actor {
	a.admin = false
	return a
}

// ── What the user sees ──────────────────────────────────────────────────

// viewer is what the user may see. Own requests and purchases given to them
// are always visible; a stage's right shows what that stage acts on.
type viewer struct {
	actor
	all, department, direction, plan bool
	// curatorOf is the directory: department → direction.
	curatorOf map[int32]int64
}

func (a actor) viewer(departments []*Department) viewer {
	v := viewer{
		actor: a,
		all: a.can(permViewAll) || a.can(permLotFullEdit) || a.can(permEconomist) || a.can(permCommission) ||
			a.can(permContract) || a.can(permProcurement) || a.can(permAcceptance) || a.can(permInventory),
		department: a.can(permViewDepartment) || a.can(permHeadReview) || a.can(permLotManage),
		direction:  a.can(permViewDirection) || a.can(permRequestCurator) || a.can(permLotCurator),
		plan:       a.can(permViewPlan) || a.can(permCommission) || a.can(permViewAll),
		curatorOf:  map[int32]int64{},
	}
	for _, d := range departments {
		v.curatorOf[d.ID] = idOf(d.CuratorID)
	}
	return v
}

func (v viewer) seesRequest(r *Request) bool {
	mine := func(d int32) bool { return d != 0 && slices.Contains(v.departments, d) }
	ours := func(id int64) bool { return id != 0 && slices.Contains(v.curators, id) }
	return v.all ||
		r.AuthorUUID != "" && r.AuthorUUID == v.uuid ||
		v.department && (mine(r.Department) || mine(r.ImplementingDepartment)) ||
		v.direction && (ours(idOf(r.CuratorID)) || ours(v.curatorOf[r.Department]) || ours(v.curatorOf[r.ImplementingDepartment]))
}

func (v viewer) seesLot(l *Lot, requests []*Request) bool {
	if v.all ||
		l.AssigneeUUID != "" && l.AssigneeUUID == v.uuid ||
		v.department && slices.Contains(v.departments, l.ImplementingDepartment) ||
		v.direction && slices.Contains(v.curators, l.CuratorID) {
		return true
	}
	for _, r := range requests {
		if idOf(r.LotID) == l.ID && v.seesRequest(r) {
			return true
		}
	}
	return false
}

// visible splits requests and purchases to what the user sees. A request
// inside a visible purchase is visible too.
func (v viewer) visible(requests []*Request, lots []*Lot) ([]*Request, []*Lot) {
	if v.all {
		return requests, lots
	}
	seen := map[int64]bool{}
	var outLots []*Lot
	for _, l := range lots {
		if v.seesLot(l, requests) {
			seen[l.ID] = true
			outLots = append(outLots, l)
		}
	}
	var outRequests []*Request
	for _, r := range requests {
		if v.seesRequest(r) || seen[idOf(r.LotID)] {
			outRequests = append(outRequests, r)
		}
	}
	return outRequests, outLots
}

// ── Who the user is ─────────────────────────────────────────────────────

const profileTTL = 5 * time.Minute

// profileCache keeps MDM's employee list for a few minutes: every call asks
// who the user is, and departments rarely change.
type profileCache struct {
	src purchase.Profiles

	mu   sync.Mutex
	list []purchase.Employee
	at   time.Time
}

func newProfileCache(src purchase.Profiles) *profileCache {
	if src == nil {
		return nil
	}
	return &profileCache{src: src}
}

func (c *profileCache) Employees(ctx context.Context) ([]purchase.Employee, error) {
	if c == nil {
		return nil, nil
	}
	c.mu.Lock()
	list, at := c.list, c.at
	c.mu.Unlock()
	if list != nil && time.Since(at) < profileTTL {
		return list, nil
	}
	list, err := c.src.Employees(ctx)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	c.list, c.at = list, time.Now()
	c.mu.Unlock()
	return list, nil
}

// profile is the user's name, job title and every department MDM lists them in.
func (c *profileCache) profile(ctx context.Context, uuid string) (string, string, []int32, error) {
	list, err := c.Employees(ctx)
	if err != nil || uuid == "" {
		return "", "", nil, err
	}
	var name, position string
	var departments []int32
	for _, e := range list {
		if e.UUID != uuid {
			continue
		}
		name, position = e.Name, e.Position
		if e.Department != 0 && !slices.Contains(departments, e.Department) {
			departments = append(departments, e.Department)
		}
	}
	return name, position, departments, nil
}

// actorOf is the signed-in user: rights from the token, departments from
// MDM, directions from the directory. A profile MDM cannot give is left
// empty — the user then has no department.
func (s *Service) actorOf(ctx context.Context) (actor, error) {
	u, ok := auth.UserFromContext(ctx)
	if !ok {
		return actor{}, connect.NewError(connect.CodeUnauthenticated, errors.New("войдите, чтобы работать с закупками"))
	}
	a := actor{uuid: u.UUID, name: u.Username, admin: u.HasRole(), perms: map[enum.PurchasePermission]bool{}}
	for _, p := range allPerms() {
		if slices.Contains(u.Permissions, permCode(p)) {
			a.perms[p] = true
		}
	}
	// Full editing is available to every authenticated portal user; it is not
	// assigned through access sets or tied to an MDM department.
	a.perms[permLotFullEdit] = true
	name, position, departments, err := s.profiles.profile(ctx, u.UUID)
	if err != nil {
		s.log.Warn("purchase v3: mdm profile unavailable", "uuid", u.UUID, "error", err.Error())
	}
	if name != "" {
		a.name = name
	}
	a.name = cut(a.name, 255)
	a.position = position
	a.departments = departments
	if a.curators, err = s.store.curatorsOfUser(ctx, u.UUID); err != nil {
		return actor{}, err
	}
	return a, nil
}
