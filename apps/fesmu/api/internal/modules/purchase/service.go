package purchase

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	entity "dvgmu/api/contract/gen/go/entity/v2"
	enum "dvgmu/api/contract/gen/go/enum/v2"
	pb "dvgmu/api/contract/gen/go/service/v2"
)

const (
	maxFileSize = 10 << 20
	maxQuantity = 1e9
	defaultUnit = "шт."
	serviceUnit = "усл."
)

const (
	logRequest = enum.PurchaseLogTarget_PURCHASE_LOG_TARGET_REQUEST
	logLot     = enum.PurchaseLogTarget_PURCHASE_LOG_TARGET_LOT
)

var fundingLabel = map[enum.PurchaseFundingSource]string{
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_UNSPECIFIED:    "не указан",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_STATE_TASK:     "субсидия на госзадание",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_TARGET_SUBSIDY: "целевая субсидия",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_INCOME:         "приносящая доход деятельность",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_OMS:            "средства ОМС",
}

var planTypeLabel = map[enum.PurchasePlanType]string{
	enum.PurchasePlanType_PURCHASE_PLAN_TYPE_UNSPECIFIED: "не выбрано",
	enum.PurchasePlanType_PURCHASE_PLAN_TYPE_PLANNED:     "плановая",
	enum.PurchasePlanType_PURCHASE_PLAN_TYPE_UNPLANNED:   "внеплановая",
}

// Service holds the purchase use cases. store is nil while purchase_db is
// unreachable; every call then answers ErrUnavailable. profiles is nil
// without MDM: users then have no department.
type Service struct {
	log      *slog.Logger
	store    *storage
	profiles *profileCache
	now      func() time.Time
}

func newService(log *slog.Logger, store *storage, profiles Profiles) *Service {
	return &Service{log: log, store: store, profiles: newProfileCache(profiles), now: time.Now}
}

func (s *Service) ready() error {
	if s.store == nil {
		return ErrUnavailable
	}
	return nil
}

func (a actor) log(target enum.PurchaseLogTarget, id int64, action, text, comment string, at time.Time) *Log {
	return &Log{
		Target: target, TargetID: id,
		ActorRole: a.role, ActorName: a.name,
		Action: action, Text: cut(text, 4096), Comment: cut(strings.TrimSpace(comment), 4096),
		CreatedAt: at,
	}
}

func cut(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
}

func tooLong(s string, n int) bool { return utf8.RuneCountInString(s) > n }

// suggestDepartment is the implementing department for a title: the
// category whose ОКПД2 prefix matches the guessed code the longest.
func suggestDepartment(categories []*Category, title string) int32 {
	code := suggestCodes(title).GetOkpd2()
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
	return best.Department
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

// curatorOfDepartment is the vice-rector the directory puts over a department.
func curatorOfDepartment(ctx context.Context, st *storage, id int32) (int64, string, error) {
	d, err := st.department(ctx, id)
	if err != nil {
		return 0, "", err
	}
	if d.CuratorID == nil {
		return 0, d.Name, invalid("для отдела «%s» не назначен курирующий проректор — обратитесь к администратору", d.Name)
	}
	return *d.CuratorID, d.Name, nil
}

// ── Overview ────────────────────────────────────────────────────────────

func (s *Service) Overview(ctx context.Context) (*pb.PurchaseOverviewResponse, error) {
	if err := s.ready(); err != nil {
		return nil, err
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
	// Each user sees their own part: a vice-rector — their direction, a head —
	// their department (visibility.go).
	v, err := s.viewerOf(ctx)
	if err != nil {
		return nil, err
	}
	requests, lots = v.visible(requests, lots)

	type key struct {
		target enum.PurchaseLogTarget
		id     int64
	}
	logsOf := map[key][]*Log{}
	for _, l := range logs {
		k := key{l.Target, l.TargetID}
		logsOf[k] = append(logsOf[k], l)
	}

	resp := &pb.PurchaseOverviewResponse{}
	lotRequests := map[int64][]int64{}
	for _, r := range requests {
		if r.LotID != nil {
			lotRequests[*r.LotID] = append(lotRequests[*r.LotID], r.ID)
		}
		p := r.ToProto(logsOf[key{logRequest, r.ID}])
		p.SuggestedDepartment = suggestDepartment(categories, r.Title)
		resp.Requests = append(resp.Requests, p)
	}
	for _, l := range lots {
		ids := lotRequests[l.ID]
		slices.Sort(ids)
		resp.Lots = append(resp.Lots, l.ToProto(ids, logsOf[key{logLot, l.ID}]))
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

	uuid, name, department, admin := s.whoAmI(ctx)
	me := &entity.PurchaseMe{Uuid: uuid, Name: name, Department: department, Admin: admin}
	if me.CuratorId, err = s.store.curatorByUser(ctx, uuid); err != nil {
		return nil, err
	}
	resp.Me = me
	return resp, nil
}

// EmployeeFetch lists MDM employees of department (0 — all).
func (s *Service) EmployeeFetch(ctx context.Context, department int32) ([]*entity.PurchaseEmployee, error) {
	if s.profiles == nil {
		return nil, ErrUnavailable
	}
	list, err := s.profiles.Employees(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*entity.PurchaseEmployee, 0, len(list))
	for _, e := range list {
		if department == 0 || e.Department == department {
			out = append(out, &entity.PurchaseEmployee{Uuid: e.UUID, Name: e.Name, Department: e.Department})
		}
	}
	slices.SortFunc(out, func(a, b *entity.PurchaseEmployee) int { return strings.Compare(a.Name, b.Name) })
	return out, nil
}

// ── Requests ────────────────────────────────────────────────────────────

type requestInput struct {
	title, unit, description string
	quantity                 float64
	itemType                 enum.PurchaseItemType
	// Only ADMIN (testing) names the department; others file for their own.
	departmentID int32
}

func (in *requestInput) normalize() {
	in.title = strings.TrimSpace(in.title)
	in.description = strings.TrimSpace(in.description)
	if in.itemType == enum.PurchaseItemType_PURCHASE_ITEM_TYPE_UNSPECIFIED {
		in.itemType = itemProduct
	}
	// The form asks only for a quantity; the unit follows from the type.
	in.unit = strings.TrimSpace(in.unit)
	if in.unit == "" {
		in.unit = defaultUnit
		if in.itemType == enum.PurchaseItemType_PURCHASE_ITEM_TYPE_SERVICE {
			in.unit = serviceUnit
		}
	}
}

func validateRequest(in requestInput) error {
	switch {
	case in.title == "":
		return invalid("укажите наименование товара или услуги")
	case tooLong(in.title, 255):
		return invalid("наименование длиннее 255 символов")
	case itemTypeLabel[in.itemType] == "":
		return invalid("укажите, товар это или услуга")
	case !(in.quantity > 0) || in.quantity > maxQuantity:
		return invalid("количество должно быть больше нуля")
	case tooLong(in.unit, 32):
		return invalid("единица измерения длиннее 32 символов")
	case tooLong(in.description, 4096):
		return invalid("описание длиннее 4096 символов")
	}
	return nil
}

func curatorPtr(id int64) *int64 {
	if id == 0 {
		return nil
	}
	return &id
}

// RequestCreate files a request for the author's own department: it goes to
// that department's head.
func (s *Service) RequestCreate(ctx context.Context, a actor, in requestInput) (int64, error) {
	if err := s.ready(); err != nil {
		return 0, err
	}
	if a.role != roleEmployee {
		return 0, forbidden("заявку подаёт сотрудник")
	}
	in.normalize()
	if err := validateRequest(in); err != nil {
		return 0, err
	}
	department := a.department
	if a.admin && in.departmentID != 0 {
		department = in.departmentID
	}
	if department == 0 {
		return 0, invalid("в вашем профиле не указан отдел — обратитесь к администратору")
	}
	d, err := s.store.department(ctx, department)
	if err != nil {
		return 0, err
	}

	now := s.now()
	r := &Request{
		Title: in.title, ItemType: in.itemType, Quantity: in.quantity, Unit: in.unit,
		Description: in.description, Department: d.Name, DepartmentID: d.ID,
		Status: reqHeadReview, AuthorName: a.name, AuthorUUID: a.uuid, Approvals: []Approval{},
		CreatedAt: now, UpdatedAt: now,
	}
	err = s.store.tx(ctx, func(tx *storage) error {
		if err := tx.createRequest(ctx, r); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.log(logRequest, r.ID, "create",
			fmt.Sprintf("Создал заявку (%s): %s — %s %s", itemTypeLabel[r.ItemType], r.Title, qty(r.Quantity), r.Unit), "", now))
	})
	return r.ID, err
}

// RequestUpdate: the author edits a request returned for rework, the head of
// its department one under review.
func (s *Service) RequestUpdate(ctx context.Context, a actor, id int64, in requestInput) error {
	if err := s.ready(); err != nil {
		return err
	}
	in.normalize()
	return s.store.tx(ctx, func(tx *storage) error {
		r, err := tx.requestLocked(ctx, id)
		if err != nil {
			return err
		}
		switch {
		case a.role == roleEmployee && r.Status == reqRework:
			if err := a.owns(r.AuthorUUID, "это заявка"); err != nil {
				return err
			}
		case a.role == roleHead && r.Status == reqHeadReview:
			if err := a.inDepartment(r.DepartmentID, "это заявка"); err != nil {
				return err
			}
		case a.role == roleEmployee || a.role == roleHead:
			return wrongState("заявка %s — сейчас её не редактируют", requestStatusLabel[r.Status])
		default:
			return forbidden("заявку правят сотрудник (на доработке) и начальник отдела (на согласовании)")
		}
		if err := validateRequest(in); err != nil {
			return err
		}

		var c change
		c.text("наименование", r.Title, in.title)
		c.text("тип", itemTypeLabel[r.ItemType], itemTypeLabel[in.itemType])
		c.text("количество", qty(r.Quantity), qty(in.quantity))
		c.text("ед. изм.", r.Unit, in.unit)
		c.text("описание", r.Description, in.description)
		if len(c) == 0 {
			return nil
		}

		now := s.now()
		r.Title, r.ItemType, r.Quantity, r.Unit, r.Description = in.title, in.itemType, in.quantity, in.unit, in.description
		r.UpdatedAt = now
		if err := tx.saveRequest(ctx, r); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.log(logRequest, r.ID, "edit", "Отредактировал заявку — "+c.String(), "", now))
	})
}

func (s *Service) curatorName(ctx context.Context, st *storage, id int64) string {
	if id == 0 {
		return "не выбран"
	}
	if c, err := st.curator(ctx, id); err == nil {
		return c.Name
	}
	return "#" + strconv.FormatInt(id, 10)
}

// RequestAction moves a request one step forward or back. implementing is
// the department VICE_RECTOR_APPROVE sends it to (0 — the suggested one).
func (s *Service) RequestAction(ctx context.Context, a actor, id int64, action enum.PurchaseRequestAction, comment string, implementing int32) error {
	if err := s.ready(); err != nil {
		return err
	}
	t, ok := requestTransitions[action]
	if !ok {
		return invalid("неизвестное действие")
	}
	comment = strings.TrimSpace(comment)
	return s.store.tx(ctx, func(tx *storage) error {
		r, err := tx.requestLocked(ctx, id)
		if err != nil {
			return err
		}
		if err := t.check(a.role, r.Status, comment, requestStatusLabel); err != nil {
			return err
		}

		text := t.text
		switch r.Status {
		case reqRework:
			err = a.owns(r.AuthorUUID, "это заявка")
		case reqHeadReview:
			err = a.inDepartment(r.DepartmentID, "это заявка")
		case reqViceRector:
			err = a.curates(r.curator())
		case reqImplementer:
			err = a.inDepartment(r.ImplementingDepartment, "заявку реализует")
		}
		if err != nil {
			return err
		}

		switch action {
		case enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_APPROVE:
			// The vice-rector over the department, by the directory. Requests
			// from before departments keep the one the head chose then.
			if r.DepartmentID != 0 {
				curatorID, _, err := curatorOfDepartment(ctx, tx, r.DepartmentID)
				if err != nil {
					return err
				}
				r.CuratorID = &curatorID
			}
			if r.CuratorID == nil {
				return invalid("у заявки нет отдела — курирующего проректора не определить")
			}
			text = fmt.Sprintf("%s: %s", text, s.curatorName(ctx, tx, r.curator()))

		case enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_APPROVE:
			if implementing == 0 {
				categories, err := tx.categories(ctx)
				if err != nil {
					return err
				}
				implementing = suggestDepartment(categories, r.Title)
			}
			if implementing == 0 {
				return invalid("выберите реализующий отдел")
			}
			if _, err := tx.department(ctx, implementing); err != nil {
				return err
			}
			r.ImplementingDepartment = implementing
			text = fmt.Sprintf("%s: %s", text, departmentName(ctx, tx, implementing))
		}

		now := s.now()
		r.Status = t.to
		r.Approvals = applyApprovals(t, r.Approvals, a.name, comment, now)
		if t.needComment {
			r.LastComment = cut(comment, 2048)
		} else {
			r.LastComment = ""
		}
		r.UpdatedAt = now
		if err := tx.saveRequest(ctx, r); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.log(logRequest, r.ID, t.key, text, comment, now))
	})
}

func (s *Service) RequestDelete(ctx context.Context, a actor, id int64) error {
	if err := s.ready(); err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		r, err := tx.requestLocked(ctx, id)
		if err != nil {
			return err
		}
		if a.role != roleEmployee {
			return forbidden("удалить заявку может только сотрудник")
		}
		if err := a.owns(r.AuthorUUID, "это заявка"); err != nil {
			return err
		}
		if r.Status != reqRework && r.Status != reqRejected {
			return wrongState("удалить можно заявку на доработке или отклонённую")
		}
		return tx.deleteRequest(ctx, id)
	})
}

// RequestMerge is the head of a department joining its requests of one type
// under review into a new request: quantities add up, the originals stay in
// the history as merged into it.
func (s *Service) RequestMerge(ctx context.Context, a actor, requestIDs []int64, title string) (int64, error) {
	if err := s.ready(); err != nil {
		return 0, err
	}
	if a.role != roleHead {
		return 0, forbidden("заявки объединяет начальник отдела")
	}
	ids := uniqueIDs(requestIDs)
	if len(ids) < 2 {
		return 0, invalid("выберите хотя бы две заявки")
	}
	title = strings.TrimSpace(title)
	if tooLong(title, 255) {
		return 0, invalid("название длиннее 255 символов")
	}

	var merged *Request
	err := s.store.tx(ctx, func(tx *storage) error {
		requests, err := tx.requestsLocked(ctx, ids)
		if err != nil {
			return err
		}
		if len(requests) != len(ids) {
			return notFound("заявка не найдена")
		}
		first := requests[0]
		var quantity float64
		var lines, authors []string
		for _, r := range requests {
			if r.Status != reqHeadReview {
				return wrongState("заявка #%d %s, объединять можно заявки на согласовании", r.ID, requestStatusLabel[r.Status])
			}
			if err := a.inDepartment(r.DepartmentID, "заявка #"+strconv.FormatInt(r.ID, 10)); err != nil {
				return err
			}
			if r.DepartmentID != first.DepartmentID {
				return invalid("объединять можно заявки одного отдела")
			}
			if r.ItemType != first.ItemType {
				return invalid("нельзя объединить товары и услуги в одну заявку")
			}
			quantity += r.Quantity
			lines = append(lines, fmt.Sprintf("#%d %s — %s %s (%s)%s", r.ID, r.Title, qty(r.Quantity), r.Unit, r.AuthorName, descSuffix(r.Description)))
			if !slices.Contains(authors, r.AuthorName) {
				authors = append(authors, r.AuthorName)
			}
		}
		if title == "" {
			title = first.Title
		}

		now := s.now()
		merged = &Request{
			Title: title, ItemType: first.ItemType, Quantity: quantity, Unit: first.Unit,
			Description: cut(strings.Join(lines, "\n"), 4096),
			Department:  first.Department, DepartmentID: first.DepartmentID,
			Status: reqHeadReview, AuthorName: cut(strings.Join(authors, ", "), 255), AuthorUUID: first.AuthorUUID,
			Approvals: []Approval{}, CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.createRequest(ctx, merged); err != nil {
			return err
		}

		logs := []*Log{a.log(logRequest, merged.ID, "merge",
			fmt.Sprintf("Объединил заявки %s в одну: %s %s", idList(requests), qty(quantity), merged.Unit), "", now)}
		for _, r := range requests {
			r.Status = reqMerged
			r.MergedIntoID = &merged.ID
			r.UpdatedAt = now
			if err := tx.saveRequest(ctx, r); err != nil {
				return err
			}
			logs = append(logs, a.log(logRequest, r.ID, "merged",
				fmt.Sprintf("Объединил заявку с другими в заявку #%d «%s»", merged.ID, merged.Title), "", now))
		}
		return tx.addLogs(ctx, logs...)
	})
	if err != nil {
		return 0, err
	}
	return merged.ID, nil
}

func descSuffix(d string) string {
	if d == "" {
		return ""
	}
	return ": " + d
}

// ── Purchases (lots) ────────────────────────────────────────────────────

// takeRequests checks that the implementing head may put requests into a
// purchase of department dep: all at its stage, of that department, one type.
func takeRequests(a actor, ids []int64, found []*Request, dep int32) error {
	if len(found) != len(ids) {
		return notFound("заявка не найдена")
	}
	for _, r := range found {
		if r.Status != reqImplementer {
			return wrongState("заявка #%d %s, в закупку объединяют заявки реализующего отдела", r.ID, requestStatusLabel[r.Status])
		}
		if r.ImplementingDepartment != dep {
			return invalid("заявку #%d реализует другой отдел", r.ID)
		}
		if err := a.inDepartment(r.ImplementingDepartment, "заявку реализует"); err != nil {
			return err
		}
		if r.ItemType != found[0].ItemType {
			return invalid("нельзя объединить товары и услуги в одну закупку")
		}
	}
	return nil
}

func uniqueIDs(ids []int64) []int64 {
	out := slices.Clone(ids)
	slices.Sort(out)
	out = slices.Compact(out)
	return slices.DeleteFunc(out, func(id int64) bool { return id <= 0 })
}

func idList(list []*Request) string {
	parts := make([]string, 0, len(list))
	for _, r := range list {
		parts = append(parts, "#"+strconv.FormatInt(r.ID, 10))
	}
	return strings.Join(parts, ", ")
}

// LotCreate is the implementing head merging similar requests into one
// purchase; the vice-rector over the implementing department curates it.
func (s *Service) LotCreate(ctx context.Context, a actor, requestIDs []int64, title string) (int64, error) {
	if err := s.ready(); err != nil {
		return 0, err
	}
	if a.role != roleHead {
		return 0, forbidden("закупку формирует начальник реализующего отдела")
	}
	ids := uniqueIDs(requestIDs)
	if len(ids) == 0 {
		return 0, invalid("выберите заявки для закупки")
	}
	title = strings.TrimSpace(title)
	if tooLong(title, 255) {
		return 0, invalid("слишком длинное название")
	}

	var lot *Lot
	err := s.store.tx(ctx, func(tx *storage) error {
		requests, err := tx.requestsLocked(ctx, ids)
		if err != nil {
			return err
		}
		if len(requests) == 0 {
			return notFound("заявка не найдена")
		}
		first := requests[0]
		if err := takeRequests(a, ids, requests, first.ImplementingDepartment); err != nil {
			return err
		}
		curatorID, _, err := curatorOfDepartment(ctx, tx, first.ImplementingDepartment)
		if err != nil {
			return err
		}

		now := s.now()
		if title == "" {
			title = first.Title
		}
		var quantity float64
		lines := make([]string, 0, len(requests))
		for _, r := range requests {
			quantity += r.Quantity
			lines = append(lines, fmt.Sprintf("#%d %s — %s %s (%s)", r.ID, r.Title, qty(r.Quantity), r.Unit, r.Department))
		}
		description := first.Description
		if len(requests) > 1 {
			description = strings.Join(lines, "\n")
		}

		codes := suggestCodes(title)
		lot = &Lot{
			Title: title, Description: cut(description, 4096), ItemType: first.ItemType,
			ImplementingDepartment: first.ImplementingDepartment, CuratorID: curatorID,
			Status: lotForming, Quantity: quantity, Unit: first.Unit,
			Okpd2: codes.GetOkpd2(), Ktru: codes.GetKtru(), Okved: codes.GetOkved(), CodesAuto: codes.GetFound(),
			PlanYear: now.Year() + 1, Approvals: []Approval{}, CreatedBy: a.name,
			CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.createLot(ctx, lot); err != nil {
			return err
		}

		logs := []*Log{a.log(logLot, lot.ID, "create",
			fmt.Sprintf("Сформировал закупку «%s» из заявок %s", lot.Title, idList(requests)), "", now)}
		for _, r := range requests {
			if err := joinLot(ctx, tx, a, r, lot, now); err != nil {
				return err
			}
			logs = append(logs, a.log(logRequest, r.ID, "join_lot",
				fmt.Sprintf("Включил заявку в закупку #%d «%s»", lot.ID, lot.Title), "", now))
		}
		return tx.addLogs(ctx, logs...)
	})
	if err != nil {
		return 0, err
	}
	return lot.ID, nil
}

func joinLot(ctx context.Context, tx *storage, a actor, r *Request, lot *Lot, now time.Time) error {
	r.LotID = &lot.ID
	r.Status = reqInLot
	r.Approvals = signOff(r.Approvals, stImplementer, a.role, a.name, fmt.Sprintf("в закупке #%d", lot.ID), now)
	r.UpdatedAt = now
	return tx.saveRequest(ctx, r)
}

// leaveLot returns a request to the implementing department's list.
func leaveLot(ctx context.Context, tx *storage, r *Request, now time.Time) error {
	r.LotID = nil
	r.Status = reqImplementer
	r.Approvals = dropFrom(r.Approvals, stImplementer)
	r.UpdatedAt = now
	return tx.saveRequest(ctx, r)
}

type lotInput struct {
	title, description, unit, comment string
	quantity                          float64

	okpd2, ktru, okved, kosgu, economistComment string
	nmck                                        int64
	fundingSource                               enum.PurchaseFundingSource

	planType          enum.PurchasePlanType
	planYear          int
	commissionComment string
}

func validPlanYear(y int) bool { return y >= 2000 && y <= 2100 }

// mayAct checks the acting user's tie to a purchase at its stage: the
// implementing head their department, the assignee themselves, the
// vice-rector their own.
func mayAct(a actor, l *Lot) error {
	switch a.role {
	case roleHead:
		return a.inDepartment(l.ImplementingDepartment, "закупку реализует")
	case roleEmployee:
		return a.owns(l.AssigneeUUID, "закупку готовит")
	case roleViceRector:
		return a.curates(l.CuratorID)
	}
	return nil
}

// LotUpdate: each role saves only its own fields at its own stage —
// implementing head (forming, checking) and assignee (specification): name,
// characteristics, quantity; vice-rector: the comment for the commission;
// economist: codes, budget, НМЦК; commission: plan type and year.
func (s *Service) LotUpdate(ctx context.Context, a actor, id int64, in lotInput) error {
	if err := s.ready(); err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, id)
		if err != nil {
			return err
		}
		if err := mayAct(a, l); err != nil {
			return err
		}

		var c change
		switch {
		case a.role == roleHead && (l.Status == lotForming || l.Status == lotCheck),
			a.role == roleEmployee && l.Status == lotSpec:
			in.title, in.unit, in.description = strings.TrimSpace(in.title), strings.TrimSpace(in.unit), strings.TrimSpace(in.description)
			// No unit sent: the purchase keeps the one its requests had.
			if in.unit == "" {
				in.unit = l.Unit
			}
			switch {
			case in.title == "" || tooLong(in.title, 255):
				return invalid("укажите название закупки (до 255 символов)")
			case !(in.quantity > 0) || in.quantity > maxQuantity:
				return invalid("количество должно быть больше нуля")
			case tooLong(in.unit, 32) || tooLong(in.description, 4096):
				return invalid("слишком длинный текст")
			}
			c.text("название", l.Title, in.title)
			c.text("характеристики", l.Description, in.description)
			c.text("количество", qty(l.Quantity), qty(in.quantity))
			c.text("ед. изм.", l.Unit, in.unit)
			// Codes nobody has checked yet follow a renamed purchase.
			if l.Title != in.title && (l.CodesAuto || l.Okpd2 == "") {
				if codes := suggestCodes(in.title); codes.GetFound() {
					l.Okpd2, l.Ktru, l.Okved, l.CodesAuto = codes.GetOkpd2(), codes.GetKtru(), codes.GetOkved(), true
				}
			}
			l.Title, l.Description, l.Quantity, l.Unit = in.title, in.description, in.quantity, in.unit

		case a.role == roleViceRector && l.Status == lotViceRector:
			in.comment = strings.TrimSpace(in.comment)
			if tooLong(in.comment, 4096) {
				return invalid("слишком длинный комментарий")
			}
			c.text("комментарий для комиссии", l.Comment, in.comment)
			l.Comment = in.comment

		case a.role == roleEconomist && l.Status == lotEconomist:
			for _, v := range []*string{&in.okpd2, &in.ktru, &in.okved, &in.kosgu, &in.economistComment} {
				*v = strings.TrimSpace(*v)
			}
			if tooLong(in.okpd2, 32) || tooLong(in.ktru, 64) || tooLong(in.okved, 32) || tooLong(in.kosgu, 32) || tooLong(in.economistComment, 2048) {
				return invalid("слишком длинный код или комментарий")
			}
			if fundingLabel[in.fundingSource] == "" {
				return invalid("неизвестный источник финансирования")
			}
			if in.nmck < 0 {
				return invalid("НМЦК не может быть отрицательной")
			}
			c.text("ОКПД2", l.Okpd2, in.okpd2)
			c.text("КТРУ", l.Ktru, in.ktru)
			c.text("ОКВЭД2", l.Okved, in.okved)
			c.text("источник", fundingLabel[l.FundingSource], fundingLabel[in.fundingSource])
			c.text("КОСГУ", l.Kosgu, in.kosgu)
			c.text("НМЦК", rubOrEmpty(l.Nmck), rubOrEmpty(in.nmck))
			c.text("комментарий экономиста", l.EconomistComment, in.economistComment)
			l.Okpd2, l.Ktru, l.Okved, l.Kosgu, l.Nmck = in.okpd2, in.ktru, in.okved, in.kosgu, in.nmck
			l.FundingSource, l.EconomistComment = in.fundingSource, in.economistComment
			if len(c) > 0 {
				l.CodesAuto = false
			}

		case a.role == roleCommission && (l.Status == lotCommission || l.Status == lotApproved || l.Status == lotRejected):
			in.commissionComment = strings.TrimSpace(in.commissionComment)
			if planTypeLabel[in.planType] == "" {
				return invalid("неизвестный тип закупки")
			}
			if !validPlanYear(in.planYear) {
				return invalid("год ПФХД должен быть от 2000 до 2100")
			}
			if tooLong(in.commissionComment, 2048) {
				return invalid("слишком длинный комментарий")
			}
			if l.Status == lotApproved && in.planType == enum.PurchasePlanType_PURCHASE_PLAN_TYPE_UNSPECIFIED {
				return invalid("у закупки в ПФХД должен быть тип: плановая или внеплановая")
			}
			c.text("тип", planTypeLabel[l.PlanType], planTypeLabel[in.planType])
			c.text("год ПФХД", strconv.Itoa(l.PlanYear), strconv.Itoa(in.planYear))
			c.text("комментарий комиссии", l.CommissionComment, in.commissionComment)
			l.PlanType, l.PlanYear, l.CommissionComment = in.planType, in.planYear, in.commissionComment

		default:
			return wrongState("закупка %s — в этой роли её сейчас не правят", lotStatusLabel[l.Status])
		}

		if len(c) == 0 {
			return nil
		}
		now := s.now()
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.log(logLot, l.ID, "edit", "Отредактировал закупку — "+c.String(), "", now))
	})
}

// LotRequests adds requests to a forming purchase or takes them out.
func (s *Service) LotRequests(ctx context.Context, a actor, lotID int64, addIDs, removeIDs []int64) error {
	if err := s.ready(); err != nil {
		return err
	}
	if a.role != roleHead {
		return forbidden("состав закупки меняет начальник реализующего отдела")
	}
	add, remove := uniqueIDs(addIDs), uniqueIDs(removeIDs)
	if len(add) == 0 && len(remove) == 0 {
		return nil
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, lotID)
		if err != nil {
			return err
		}
		if err := mayAct(a, l); err != nil {
			return err
		}
		if l.Status != lotForming {
			return wrongState("закупка %s — состав меняют, пока она формируется", lotStatusLabel[l.Status])
		}
		current, err := tx.lotRequests(ctx, l.ID)
		if err != nil {
			return err
		}

		now := s.now()
		var logs []*Log
		var taken []*Request
		for _, r := range current {
			if slices.Contains(remove, r.ID) {
				taken = append(taken, r)
			}
		}
		if len(taken) != len(remove) {
			return invalid("заявки нет в этой закупке")
		}
		if len(current)-len(taken)+len(add) < 1 {
			return invalid("в закупке должна остаться хотя бы одна заявка — или расформируйте её")
		}
		for _, r := range taken {
			if err := leaveLot(ctx, tx, r, now); err != nil {
				return err
			}
			l.Quantity = math.Max(0, l.Quantity-r.Quantity)
			logs = append(logs, a.log(logRequest, r.ID, "leave_lot",
				fmt.Sprintf("Исключил заявку из закупки #%d «%s»", l.ID, l.Title), "", now))
		}

		var added []*Request
		if len(add) > 0 {
			added, err = tx.requestsLocked(ctx, add)
			if err != nil {
				return err
			}
			if err := takeRequests(a, add, added, l.ImplementingDepartment); err != nil {
				return err
			}
			for _, r := range added {
				if r.ItemType != l.ItemType {
					return invalid("нельзя объединить товары и услуги в одну закупку")
				}
			}
			for _, r := range added {
				if err := joinLot(ctx, tx, a, r, l, now); err != nil {
					return err
				}
				l.Quantity += r.Quantity
				logs = append(logs, a.log(logRequest, r.ID, "join_lot",
					fmt.Sprintf("Включил заявку в закупку #%d «%s»", l.ID, l.Title), "", now))
			}
		}

		var parts []string
		if len(added) > 0 {
			parts = append(parts, "добавил заявки "+idList(added))
		}
		if len(taken) > 0 {
			parts = append(parts, "исключил заявки "+idList(taken))
		}
		logs = append(logs, a.log(logLot, l.ID, "requests",
			fmt.Sprintf("Изменил состав закупки: %s; количество теперь %s %s", strings.Join(parts, ", "), qty(l.Quantity), l.Unit), "", now))

		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, logs...)
	})
}

// lotActionInput carries what some actions need besides the comment.
type lotActionInput struct {
	comment      string
	planType     enum.PurchasePlanType
	planYear     int
	assigneeUUID string
	assigneeName string
}

func (s *Service) LotAction(ctx context.Context, a actor, id int64, action enum.PurchaseLotAction, in lotActionInput) error {
	if err := s.ready(); err != nil {
		return err
	}
	comment := strings.TrimSpace(in.comment)
	if action == enum.PurchaseLotAction_PURCHASE_LOT_ACTION_DISBAND {
		return s.lotDisband(ctx, a, id, comment)
	}
	t, ok := lotTransitions[action]
	if !ok {
		return invalid("неизвестное действие")
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, id)
		if err != nil {
			return err
		}
		if err := t.check(a.role, l.Status, comment, lotStatusLabel); err != nil {
			return err
		}
		if err := mayAct(a, l); err != nil {
			return err
		}

		text := t.text
		switch action {
		case enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ASSIGN:
			uuid, name := strings.TrimSpace(in.assigneeUUID), strings.TrimSpace(in.assigneeName)
			if uuid == "" {
				return invalid("выберите сотрудника, который подготовит закупку")
			}
			l.AssigneeUUID, l.AssigneeName = cut(uuid, 64), cut(name, 255)
			text = fmt.Sprintf("%s: %s", text, l.AssigneeName)

		case enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SPEC_DONE,
			enum.PurchaseLotAction_PURCHASE_LOT_ACTION_CHECK_APPROVE,
			enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST:
			if len(l.Quotations) == 0 {
				return invalid("прикрепите хотя бы одно КП — по ним считается стоимость")
			}
			if !(l.Quantity > 0) {
				return invalid("количество должно быть больше нуля")
			}
			// The head's check pulls the codes from the list, at first.
			if l.Okpd2 == "" && l.Ktru == "" {
				if codes := suggestCodes(l.Title); codes.GetFound() {
					l.Okpd2, l.Ktru, l.Okved, l.CodesAuto = codes.GetOkpd2(), codes.GetKtru(), codes.GetOkved(), true
				}
			}
			if action == enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST {
				_, _, total := l.Price()
				text = fmt.Sprintf("%s; по %d КП — %s (средняя цена × количество)", text, len(l.Quotations), rub(total))
			}

		case enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ECONOMIST_APPROVE:
			switch {
			case l.Okpd2 == "" && l.Ktru == "":
				return invalid("укажите ОКПД2 или КТРУ")
			case l.Okved == "":
				return invalid("укажите ОКВЭД2")
			case l.FundingSource == enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_UNSPECIFIED:
				return invalid("укажите источник финансирования")
			}
			l.CodesAuto = false
			// Not entered: the economist accepts the average-based amount.
			if l.Nmck == 0 {
				_, _, l.Nmck = l.Price()
			}
			if l.Nmck <= 0 {
				return invalid("укажите НМЦК")
			}
			text = fmt.Sprintf("%s; НМЦК %s", text, rub(l.Nmck))

		case enum.PurchaseLotAction_PURCHASE_LOT_ACTION_COMMISSION_APPROVE:
			if in.planType != enum.PurchasePlanType_PURCHASE_PLAN_TYPE_UNSPECIFIED {
				if planTypeLabel[in.planType] == "" {
					return invalid("неизвестный тип закупки")
				}
				l.PlanType = in.planType
			}
			if in.planYear != 0 {
				l.PlanYear = in.planYear
			}
			if l.PlanType == enum.PurchasePlanType_PURCHASE_PLAN_TYPE_UNSPECIFIED {
				return invalid("выберите: плановая или внеплановая закупка")
			}
			if !validPlanYear(l.PlanYear) {
				return invalid("укажите год ПФХД")
			}
			text = fmt.Sprintf("%s на %d год (%s)", text, l.PlanYear, planTypeLabel[l.PlanType])
		}
		// The commission's reasoning stays on the purchase, not only in the log.
		if t.role == roleCommission && comment != "" {
			l.CommissionComment = cut(comment, 2048)
		}

		// Back where offers and quantity may change: the economist sets НМЦК again.
		if t.to == lotForming || t.to == lotSpec || t.to == lotCheck {
			l.Nmck = 0
		}

		now := s.now()
		l.Status = t.to
		l.Approvals = applyApprovals(t, l.Approvals, a.name, comment, now)
		if t.needComment {
			l.LastComment = cut(comment, 2048)
		} else {
			l.LastComment = ""
		}
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.log(logLot, l.ID, t.key, text, comment, now))
	})
}

// lotDisband deletes a forming purchase; its requests go back to the
// implementing department's list.
func (s *Service) lotDisband(ctx context.Context, a actor, id int64, comment string) error {
	if a.role != roleHead {
		return forbidden("расформировать закупку может начальник реализующего отдела")
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, id)
		if err != nil {
			return err
		}
		if err := mayAct(a, l); err != nil {
			return err
		}
		if l.Status != lotForming {
			return wrongState("закупка %s — расформировать можно только формирующуюся", lotStatusLabel[l.Status])
		}
		requests, err := tx.lotRequests(ctx, l.ID)
		if err != nil {
			return err
		}
		now := s.now()
		logs := make([]*Log, 0, len(requests))
		for _, r := range requests {
			if err := leaveLot(ctx, tx, r, now); err != nil {
				return err
			}
			logs = append(logs, a.log(logRequest, r.ID, "lot_disband",
				fmt.Sprintf("Расформировал закупку #%d «%s» — заявка снова в реализующем отделе", l.ID, l.Title), comment, now))
		}
		if err := tx.deleteLot(ctx, l.ID); err != nil {
			return err
		}
		return tx.addLogs(ctx, logs...)
	})
}

// ── Commercial offers ───────────────────────────────────────────────────

type quotationInput struct {
	supplier, note, fileName string
	unitPrice                int64
	content                  []byte
}

// mayEditOffers: the assignee while preparing, the implementing head while
// forming or checking.
func mayEditOffers(a actor, l *Lot) error {
	switch {
	case a.role == roleEmployee && l.Status == lotSpec,
		a.role == roleHead && (l.Status == lotForming || l.Status == lotCheck):
		return mayAct(a, l)
	case a.role == roleEmployee || a.role == roleHead:
		return wrongState("закупка %s — КП сейчас не меняют", lotStatusLabel[l.Status])
	}
	return forbidden("КП прикрепляет исполнитель или начальник реализующего отдела")
}

func (s *Service) QuotationCreate(ctx context.Context, a actor, lotID int64, in quotationInput) (int64, error) {
	if err := s.ready(); err != nil {
		return 0, err
	}
	in.supplier, in.note = strings.TrimSpace(in.supplier), strings.TrimSpace(in.note)
	in.fileName = strings.TrimSpace(filepath.Base(strings.ReplaceAll(in.fileName, "\\", "/")))
	if in.fileName == "." || in.fileName == "/" {
		in.fileName = ""
	}
	switch {
	case in.supplier == "" || tooLong(in.supplier, 255):
		return 0, invalid("укажите поставщика (до 255 символов)")
	case in.unitPrice <= 0:
		return 0, invalid("цена за единицу должна быть больше нуля")
	case tooLong(in.note, 1024):
		return 0, invalid("примечание длиннее 1024 символов")
	case len(in.content) > maxFileSize:
		return 0, invalid("файл КП больше 10 МБ")
	}
	if len(in.content) > 0 && in.fileName == "" {
		in.fileName = "КП"
	}
	if len(in.content) == 0 {
		in.fileName = ""
	}
	in.fileName = cut(in.fileName, 255)

	var q *Quotation
	err := s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, lotID)
		if err != nil {
			return err
		}
		if err := mayEditOffers(a, l); err != nil {
			return err
		}
		now := s.now()
		q = &Quotation{
			LotID: l.ID, Supplier: in.supplier, UnitPrice: in.unitPrice, Note: in.note,
			FileName: in.fileName, FileSize: int64(len(in.content)), FileContent: in.content,
			CreatedBy: a.name, CreatedAt: now,
		}
		if err := tx.createQuotation(ctx, q); err != nil {
			return err
		}
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.log(logLot, l.ID, "quotation_add",
			fmt.Sprintf("Прикрепил КП: %s — %s за ед.", q.Supplier, rub(q.UnitPrice)), q.Note, now))
	})
	if err != nil {
		return 0, err
	}
	return q.ID, nil
}

func (s *Service) QuotationDelete(ctx context.Context, a actor, id int64) error {
	if err := s.ready(); err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		q, err := tx.quotation(ctx, id, false)
		if err != nil {
			return err
		}
		l, err := tx.lotLocked(ctx, q.LotID)
		if err != nil {
			return err
		}
		if err := mayEditOffers(a, l); err != nil {
			return err
		}
		if err := tx.deleteQuotation(ctx, q.ID); err != nil {
			return err
		}
		now := s.now()
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.log(logLot, l.ID, "quotation_delete",
			fmt.Sprintf("Удалил КП: %s — %s за ед.", q.Supplier, rub(q.UnitPrice)), "", now))
	})
}

func (s *Service) QuotationFile(ctx context.Context, id int64) (*Quotation, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	q, err := s.store.quotation(ctx, id, true)
	if err != nil {
		return nil, err
	}
	if q.FileSize == 0 {
		return nil, notFound("у КП нет файла")
	}
	// Only from a purchase the user sees.
	v, err := s.viewerOf(ctx)
	if err != nil {
		return nil, err
	}
	if !v.all {
		err = s.store.tx(ctx, func(tx *storage) error {
			l, err := tx.lotLocked(ctx, q.LotID)
			if err != nil {
				return err
			}
			requests, err := tx.lotRequests(ctx, l.ID)
			if err != nil {
				return err
			}
			if !v.ownLot(l, requests) {
				return notFound("КП не найдено")
			}
			return nil
		})
		if err != nil {
			return nil, err
		}
	}
	return q, nil
}

func (s *Service) CodeSuggest(title string) *entity.PurchaseCodeSuggestion {
	return suggestCodes(title)
}
