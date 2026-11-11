package purchasev3

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	enum "fesmu/contract/fesmu/enum/v3"
)

// The route, by the regulation (Регламент закупок, п. 4): for every stage,
// who acts (the permission and whose records — scope), where FORWARD and
// RETURN lead, and what must be done before moving on. Pure; tested in
// route_test.go.

const (
	roleEmployee        = enum.PurchaseRole_PURCHASE_ROLE_EMPLOYEE
	roleHead            = enum.PurchaseRole_PURCHASE_ROLE_HEAD
	roleCurator         = enum.PurchaseRole_PURCHASE_ROLE_CURATOR
	roleImplementerHead = enum.PurchaseRole_PURCHASE_ROLE_IMPLEMENTER_HEAD
	roleAssignee        = enum.PurchaseRole_PURCHASE_ROLE_ASSIGNEE
	roleEconomist       = enum.PurchaseRole_PURCHASE_ROLE_ECONOMIST
	roleCommission      = enum.PurchaseRole_PURCHASE_ROLE_COMMISSION
	roleContract        = enum.PurchaseRole_PURCHASE_ROLE_CONTRACT_SERVICE
	roleProcurement     = enum.PurchaseRole_PURCHASE_ROLE_PROCUREMENT
	roleAcceptance      = enum.PurchaseRole_PURCHASE_ROLE_ACCEPTANCE
	roleInventory       = enum.PurchaseRole_PURCHASE_ROLE_INVENTORY
)

var roleLabel = map[enum.PurchaseRole]string{
	roleEmployee:        "Сотрудник",
	roleHead:            "Начальник отдела",
	roleCurator:         "Курирующий проректор",
	roleImplementerHead: "Начальник реализующего отдела",
	roleAssignee:        "Исполнитель",
	roleEconomist:       "Экономический отдел",
	roleCommission:      "Бюджетная комиссия",
	roleContract:        "Контрактная служба",
	roleProcurement:     "Отдел закупок",
	roleAcceptance:      "Приёмка",
	roleInventory:       "Учёт инвентаря",
}

const (
	permViewDepartment = enum.PurchasePermission_PURCHASE_PERMISSION_VIEW_DEPARTMENT
	permViewDirection  = enum.PurchasePermission_PURCHASE_PERMISSION_VIEW_DIRECTION
	permViewAll        = enum.PurchasePermission_PURCHASE_PERMISSION_VIEW_ALL
	permViewPlan       = enum.PurchasePermission_PURCHASE_PERMISSION_VIEW_PLAN
	permViewActivity   = enum.PurchasePermission_PURCHASE_PERMISSION_VIEW_ACTIVITY
	permRequestCreate  = enum.PurchasePermission_PURCHASE_PERMISSION_REQUEST_CREATE
	permHeadReview     = enum.PurchasePermission_PURCHASE_PERMISSION_REQUEST_HEAD_REVIEW
	permRequestCurator = enum.PurchasePermission_PURCHASE_PERMISSION_REQUEST_CURATOR_REVIEW
	permLotManage      = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_MANAGE
	permLotPrepare     = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_PREPARE
	permLotCurator     = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_CURATOR_REVIEW
	permEconomist      = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_ECONOMIST
	permCommission     = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_COMMISSION
	permContract       = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_CONTRACT_SERVICE
	permProcurement    = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_PROCUREMENT
	permAcceptance     = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_ACCEPTANCE
	permInventory      = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_INVENTORY
	permDirectories    = enum.PurchasePermission_PURCHASE_PERMISSION_DIRECTORIES
	permLotFullEdit    = enum.PurchasePermission_PURCHASE_PERMISSION_LOT_FULL_EDIT
)

const (
	reqHeadReview  = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_HEAD_REVIEW
	reqRework      = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_REWORK
	reqCurator     = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_CURATOR_REVIEW
	reqImplementer = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_IMPLEMENTER_REVIEW
	reqInPurchase  = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_IN_PURCHASE
	reqMerged      = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_MERGED
	reqRejected    = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_REJECTED
)

var requestStatusLabel = map[enum.PurchaseRequestStatus]string{
	reqHeadReview:  "у начальника отдела",
	reqRework:      "на доработке у сотрудника",
	reqCurator:     "у курирующего проректора",
	reqImplementer: "в реализующем отделе",
	reqInPurchase:  "в закупке",
	reqMerged:      "объединена с другими",
	reqRejected:    "отклонена",
}

const (
	lotForming         = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_FORMING
	lotSpecification   = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_SPECIFICATION
	lotSpecCheck       = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_SPECIFICATION_CHECK
	lotCuratorReview   = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_CURATOR_REVIEW
	lotEconomistReview = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_ECONOMIST_REVIEW
	lotCommission      = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_BUDGET_COMMISSION
	lotRejected        = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_REJECTED
	lotApproved        = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_APPROVED
	lotTechSpec        = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_TECH_SPEC
	lotTechSpecCheck   = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_TECH_SPEC_CHECK
	lotTechSpecCurator = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_TECH_SPEC_CURATOR
	lotFinalCost       = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_FINAL_COST
	lotContractService = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_CONTRACT_SERVICE
	lotProcurement     = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_PROCUREMENT
	lotTendering       = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_TENDERING
	lotContracting     = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_CONTRACTING
	lotDelivery        = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_DELIVERY
	lotAcceptance      = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_ACCEPTANCE
	lotInventory       = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_INVENTORY
	lotCompleted       = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_COMPLETED
)

var lotStatusLabel = map[enum.PurchaseLotStatus]string{
	lotForming:         "у начальника реализующего отдела",
	lotSpecification:   "у исполнителя: характеристики и КП",
	lotSpecCheck:       "на проверке у начальника реализующего отдела",
	lotCuratorReview:   "у курирующего проректора",
	lotEconomistReview: "в экономическом отделе",
	lotCommission:      "на бюджетной комиссии",
	lotRejected:        "отклонена комиссией",
	lotApproved:        "одобрена комиссией, у начальника реализующего отдела",
	lotTechSpec:        "у исполнителя: техническое задание",
	lotTechSpecCheck:   "ТЗ на проверке у начальника реализующего отдела",
	lotTechSpecCurator: "ТЗ у курирующего проректора",
	lotFinalCost:       "в экономическом отделе: конечная стоимость",
	lotContractService: "в контрактной службе",
	lotProcurement:     "в отделе закупок",
	lotTendering:       "проводится закупка",
	lotContracting:     "заключается контракт",
	lotDelivery:        "исполняется контракт",
	lotAcceptance:      "на приёмке",
	lotInventory:       "ставится на учёт",
	lotCompleted:       "завершена",
}

const (
	moveForward = enum.PurchaseMove_PURCHASE_MOVE_FORWARD
	moveReturn  = enum.PurchaseMove_PURCHASE_MOVE_RETURN
	moveReject  = enum.PurchaseMove_PURCHASE_MOVE_REJECT
)

const (
	itemProduct = enum.PurchaseItemType_PURCHASE_ITEM_TYPE_PRODUCT
	itemService = enum.PurchaseItemType_PURCHASE_ITEM_TYPE_SERVICE
)

var itemTypeLabel = map[enum.PurchaseItemType]string{itemProduct: "товар", itemService: "услуга"}

// scope is whose records a stage's holder may act on.
type scope int

const (
	scopeAuthor       scope = iota + 1 // the request's author
	scopeDepartment                    // the request's department (the author's)
	scopeCurator                       // the record's vice-rector direction
	scopeImplementing                  // the implementing department
	scopeAssignee                      // the one the purchase is given to
	scopeAll                           // anyone with the permission
)

// stage is one step of the route. S is a request's or a purchase's status.
type stage[S comparable] struct {
	status S
	role   enum.PurchaseRole
	perm   enum.PurchasePermission
	scope  scope
	// Zero: no such move here (FORWARD may then be another call, e.g.
	// a purchase from requests, or the commission's protocol).
	next, prev S
	reject     bool
	// forward tells what the user did, in the log.
	forward string
	// days is the stage's term in working days, from when the record came
	// to it. The regulation (п. 7.1) leaves the terms to a separate order;
	// these are the working defaults until it is issued.
	days int
}

var requestRoute = []stage[enum.PurchaseRequestStatus]{
	{status: reqRework, days: 5, role: roleEmployee, perm: permRequestCreate, scope: scopeAuthor,
		next: reqHeadReview, forward: "Доработал заявку и отправил начальнику отдела"},
	{status: reqHeadReview, days: 3, role: roleHead, perm: permHeadReview, scope: scopeDepartment,
		next: reqCurator, prev: reqRework, reject: true, forward: "Согласовал заявку и передал курирующему проректору"},
	{status: reqCurator, days: 3, role: roleCurator, perm: permRequestCurator, scope: scopeCurator,
		next: reqImplementer, prev: reqHeadReview, reject: true, forward: "Согласовал заявку и передал в реализующий отдел"},
	{status: reqImplementer, days: 5, role: roleImplementerHead, perm: permLotManage, scope: scopeImplementing,
		prev: reqCurator},
}

var lotRoute = []stage[enum.PurchaseLotStatus]{
	// Этап I. Планирование.
	{status: lotForming, days: 5, role: roleImplementerHead, perm: permLotManage, scope: scopeImplementing,
		next: lotSpecification, forward: "Передал закупку исполнителю: характеристики и КП"},
	{status: lotSpecification, days: 10, role: roleAssignee, perm: permLotPrepare, scope: scopeAssignee,
		next: lotSpecCheck, prev: lotForming, forward: "Подготовил характеристики и КП, передал начальнику на проверку"},
	{status: lotSpecCheck, days: 3, role: roleImplementerHead, perm: permLotManage, scope: scopeImplementing,
		next: lotCuratorReview, prev: lotSpecification, forward: "Проверил работу исполнителя и передал проректору"},
	{status: lotCuratorReview, days: 3, role: roleCurator, perm: permLotCurator, scope: scopeCurator,
		next: lotEconomistReview, prev: lotSpecCheck, forward: "Согласовал закупку и передал в экономический отдел"},
	{status: lotEconomistReview, days: 5, role: roleEconomist, perm: permEconomist, scope: scopeAll,
		next: lotCommission, prev: lotCuratorReview, forward: "Утвердил бюджет и НМЦК, передал на бюджетную комиссию"},
	// FORWARD is the protocol (PurchaseProtocolCreate).
	{status: lotCommission, days: 20, role: roleCommission, perm: permCommission, scope: scopeAll,
		prev: lotEconomistReview},
	// Этап II. Подготовка.
	{status: lotApproved, days: 3, role: roleImplementerHead, perm: permLotManage, scope: scopeImplementing,
		next: lotTechSpec, forward: "Поручил исполнителю техническое задание"},
	{status: lotTechSpec, days: 10, role: roleAssignee, perm: permLotPrepare, scope: scopeAssignee,
		next: lotTechSpecCheck, prev: lotApproved, forward: "Составил ТЗ и передал начальнику на проверку"},
	{status: lotTechSpecCheck, days: 3, role: roleImplementerHead, perm: permLotManage, scope: scopeImplementing,
		next: lotTechSpecCurator, prev: lotTechSpec, forward: "Проверил ТЗ и передал проректору на подтверждение"},
	{status: lotTechSpecCurator, days: 3, role: roleCurator, perm: permLotCurator, scope: scopeCurator,
		next: lotFinalCost, prev: lotTechSpecCheck, forward: "Подтвердил ТЗ и передал экономистам"},
	{status: lotFinalCost, days: 5, role: roleEconomist, perm: permEconomist, scope: scopeAll,
		next: lotContractService, prev: lotTechSpecCurator, forward: "Утвердил конечную стоимость и передал в контрактную службу"},
	{status: lotContractService, days: 5, role: roleContract, perm: permContract, scope: scopeAll,
		next: lotProcurement, prev: lotFinalCost, forward: "Определил закон и способ закупки, передал в отдел закупок"},
	{status: lotProcurement, days: 5, role: roleProcurement, perm: permProcurement, scope: scopeAll,
		next: lotTendering, prev: lotContractService, forward: "Принял данные и начал проведение закупки"},
	// Этап III. Исполнение.
	{status: lotTendering, days: 20, role: roleProcurement, perm: permProcurement, scope: scopeAll,
		next: lotContracting, prev: lotProcurement, forward: "Определил поставщика"},
	{status: lotContracting, days: 10, role: roleProcurement, perm: permProcurement, scope: scopeAll,
		next: lotDelivery, prev: lotTendering, forward: "Заключил контракт"},
	{status: lotDelivery, days: 30, role: roleProcurement, perm: permProcurement, scope: scopeAll,
		next: lotAcceptance, prev: lotContracting, forward: "Отметил поставку, передал на приёмку"},
	// A service skips INVENTORY (nextLot).
	{status: lotAcceptance, days: 5, role: roleAcceptance, perm: permAcceptance, scope: scopeAll,
		next: lotInventory, prev: lotDelivery, forward: "Принял поставку"},
	{status: lotInventory, days: 5, role: roleInventory, perm: permInventory, scope: scopeAll,
		next: lotCompleted, prev: lotAcceptance, forward: "Поставил принятое на учёт в инвентаре, закупка завершена"},
}

// stageOf finds status in route; ok false for a status nobody acts at
// (merged, rejected, completed...).
func stageOf[S comparable](route []stage[S], status S) (stage[S], int, bool) {
	for i, st := range route {
		if st.status == status {
			return st, i, true
		}
	}
	return stage[S]{}, -1, false
}

// order is the place of status in route: sign-offs from the place a record
// returns to on are dropped. -1 for a status off the route.
func order[S comparable](route []stage[S], status S) int {
	_, i, _ := stageOf(route, status)
	return i
}

// nextLot is where FORWARD leads from the purchase's stage: a service needs
// no inventory.
func nextLot(l *Lot, st stage[enum.PurchaseLotStatus]) enum.PurchaseLotStatus {
	if st.status == lotAcceptance && l.ItemType == itemService {
		return lotCompleted
	}
	return st.next
}

// lotReady says what is missing before the purchase may move on from its stage.
func lotReady(l *Lot) error {
	switch l.Status {
	case lotForming, lotApproved:
		if l.AssigneeUUID == "" {
			return invalid("выберите исполнителя")
		}
	case lotSpecification:
		if strings.TrimSpace(l.Specification) == "" {
			return invalid("опишите характеристики объекта закупки")
		}
		if len(l.Quotations) == 0 {
			return invalid("прикрепите хотя бы одно КП")
		}
	case lotSpecCheck:
		if l.Okpd2 == "" {
			return invalid("укажите код ОКПД2 — по наименованию он не определился")
		}
	case lotCuratorReview:
		if strings.TrimSpace(l.CuratorJustification) == "" {
			return invalid("напишите обоснование закупки для бюджетной комиссии")
		}
	case lotEconomistReview:
		switch {
		case l.FundingSource == enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_UNSPECIFIED:
			return invalid("укажите источник финансирования")
		case l.Kosgu == "":
			return invalid("укажите КОСГУ")
		case l.Okpd2 == "":
			return invalid("укажите код ОКПД2")
		case l.Amount() <= 0:
			return invalid("нет КП — не из чего определить НМЦК; верните закупку")
		}
	case lotTechSpec:
		if strings.TrimSpace(l.TechSpec) == "" && !l.hasDocument(enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_TECH_SPEC) {
			return invalid("напишите ТЗ или прикрепите его файлом")
		}
	case lotFinalCost:
		if l.FinalCost <= 0 {
			return invalid("укажите конечную стоимость")
		}
	case lotContractService:
		if l.Law == enum.PurchaseLaw_PURCHASE_LAW_UNSPECIFIED || l.Method == enum.PurchaseMethod_PURCHASE_METHOD_UNSPECIFIED {
			return invalid("укажите закон и способ закупки")
		}
	case lotProcurement:
		if l.Method != enum.PurchaseMethod_PURCHASE_METHOD_SINGLE_SUPPLIER && l.NoticeNumber == "" {
			return invalid("укажите номер извещения в ЕИС")
		}
	case lotTendering:
		if l.Supplier == "" {
			return invalid("укажите поставщика")
		}
	case lotContracting:
		if l.ContractNumber == "" || l.ContractAt == nil || l.ContractAmount <= 0 {
			return invalid("укажите номер, дату и сумму контракта")
		}
	case lotDelivery:
		if l.DeliveredAt == nil {
			return invalid("укажите дату поставки")
		}
	case lotAcceptance:
		if l.AcceptedAt == nil {
			return invalid("укажите дату приёмки")
		}
	case lotInventory:
		if len(l.InventoryNumbers) == 0 {
			return invalid("укажите инвентарные номера поставленного")
		}
	}
	return nil
}

func (l *Lot) hasDocument(kind enum.PurchaseDocumentKind) bool {
	return slices.ContainsFunc(l.Documents, func(d Document) bool { return d.Kind == kind })
}

// ── Terms ───────────────────────────────────────────────────────────────

// addWorkdays is t moved n working days on (Saturdays and Sundays skipped).
func addWorkdays(t time.Time, n int) time.Time {
	for n > 0 {
		t = t.AddDate(0, 0, 1)
		if wd := t.Weekday(); wd != time.Saturday && wd != time.Sunday {
			n--
		}
	}
	return t
}

// stageDue is by when the stage begun at since must be done; nil when
// nobody acts at the stage or it is not known when it began.
func stageDue[S comparable](route []stage[S], status S, since *time.Time) *time.Time {
	st, _, ok := stageOf(route, status)
	if !ok || since == nil || st.days == 0 {
		return nil
	}
	due := addWorkdays(*since, st.days)
	return &due
}

func requestStageDue(r *Request) *time.Time { return stageDue(requestRoute, r.Status, r.StageSince) }

// lotStageDue: while the contract is fulfilled, its own term counts.
func lotStageDue(l *Lot) *time.Time {
	if l.Status == lotDelivery && l.DeliveryDue != nil {
		return l.DeliveryDue
	}
	return stageDue(lotRoute, l.Status, l.StageSince)
}

// ── Sign-offs ───────────────────────────────────────────────────────────

// signOff replaces the sign-off of stage with a fresh one.
func signOff(list []SignOff, s SignOff) []SignOff {
	out := slices.DeleteFunc(slices.Clone(list), func(x SignOff) bool { return x.Stage == s.Stage })
	return append(out, s)
}

// dropFrom forgets the sign-offs at place from and later in route: the record
// is back there, and they must be given again.
func dropFrom[S ~int32](list []SignOff, route []stage[S], from int) []SignOff {
	return slices.DeleteFunc(slices.Clone(list), func(x SignOff) bool {
		return order(route, S(x.Stage)) >= from
	})
}

// ── Formatting for the log ──────────────────────────────────────────────

// rub formats kopecks as "12 345,67 ₽".
func rub(kop int64) string {
	sign := ""
	if kop < 0 {
		sign, kop = "-", -kop
	}
	whole := strconv.FormatInt(kop/100, 10)
	var b strings.Builder
	for i, r := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteRune(' ')
		}
		b.WriteRune(r)
	}
	return fmt.Sprintf("%s%s,%02d ₽", sign, b.String(), kop%100)
}

// qty prints a quantity without a trailing ".0".
func qty(v float64) string {
	return strings.Replace(strconv.FormatFloat(v, 'f', -1, 64), ".", ",", 1)
}

func day(t *time.Time) string {
	if t == nil {
		return "—"
	}
	return t.Format("02.01.2006")
}

// change collects "field: old → new" for the log.
type change []string

func (c *change) text(label, before, after string) {
	if before != after {
		*c = append(*c, fmt.Sprintf("%s: «%s» → «%s»", label, before, after))
	}
}

func (c change) String() string { return strings.Join(c, "; ") }
