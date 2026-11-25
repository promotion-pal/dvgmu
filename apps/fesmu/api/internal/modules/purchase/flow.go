package purchase

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	enum "fesmu/contract/fesmu/enum/v2"
)

const (
	roleEmployee   = enum.PurchaseActorRole_PURCHASE_ACTOR_ROLE_EMPLOYEE
	roleHead       = enum.PurchaseActorRole_PURCHASE_ACTOR_ROLE_DEPT_HEAD
	roleViceRector = enum.PurchaseActorRole_PURCHASE_ACTOR_ROLE_VICE_RECTOR
	roleEconomist  = enum.PurchaseActorRole_PURCHASE_ACTOR_ROLE_ECONOMIST
	roleCommission = enum.PurchaseActorRole_PURCHASE_ACTOR_ROLE_BUDGET_COMMISSION
)

const (
	reqHeadReview  = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_HEAD_REVIEW
	reqRework      = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_REWORK
	reqViceRector  = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_VICE_RECTOR_REVIEW
	reqImplementer = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_IMPLEMENTER_REVIEW
	reqInLot       = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_IN_LOT
	reqRejected    = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_REJECTED
	reqMerged      = enum.PurchaseRequestStatus_PURCHASE_REQUEST_STATUS_MERGED
)

const itemProduct = enum.PurchaseItemType_PURCHASE_ITEM_TYPE_PRODUCT

var itemTypeLabel = map[enum.PurchaseItemType]string{
	itemProduct: "товар",
	enum.PurchaseItemType_PURCHASE_ITEM_TYPE_SERVICE: "услуга",
}

const (
	lotForming    = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_FORMING
	lotSpec       = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_SPECIFICATION
	lotCheck      = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_IMPLEMENTER_CHECK
	lotViceRector = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_VICE_RECTOR_REVIEW
	lotEconomist  = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_ECONOMIST_REVIEW
	lotCommission = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_BUDGET_COMMISSION
	lotApproved   = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_APPROVED
	lotRejected   = enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_REJECTED
)

var roleLabel = map[enum.PurchaseActorRole]string{
	roleEmployee:   "Сотрудник",
	roleHead:       "Начальник отдела",
	roleViceRector: "Курирующий проректор",
	roleEconomist:  "Экономический отдел",
	roleCommission: "Бюджетная комиссия",
}

var requestStatusLabel = map[enum.PurchaseRequestStatus]string{
	reqHeadReview:  "у начальника отдела",
	reqRework:      "на доработке",
	reqViceRector:  "у проректора",
	reqImplementer: "у реализующего отдела",
	reqInLot:       "в закупке",
	reqRejected:    "отклонена",
	reqMerged:      "объединена с другими",
}

var lotStatusLabel = map[enum.PurchaseLotStatus]string{
	lotForming:    "у реализующего начальника",
	lotSpec:       "у исполнителя",
	lotCheck:      "на проверке у реализующего начальника",
	lotViceRector: "у проректора",
	lotEconomist:  "в экономическом отделе",
	lotCommission: "на бюджетной комиссии",
	lotApproved:   "включена в ПФХД",
	lotRejected:   "отклонена",
}

// Stages in flow order. A sign-off belongs to a stage; going back to a stage
// drops the sign-offs of it and every later one. The department head acts
// twice (own department, then implementing), so the order is by stage, not
// by role.
const (
	stEmployee    = 1 // the author
	stHead        = 2 // head of the author's department
	stCurator     = 3 // vice-rector over the author's department
	stImplementer = 4 // implementing head: requests into a purchase, assignee
	stSpec        = 5 // assignee: specification, offers
	stCheck       = 6 // implementing head checks the assignee's work
	stLotCurator  = 7 // vice-rector over the implementing department
	stEconomist   = 8
	stCommission  = 9
)

// transition is one action: who may take it, from where, to where.
type transition[S comparable] struct {
	key  string
	role enum.PurchaseActorRole
	from []S
	to   S
	// approve records the actor's sign-off at stage; otherwise, with back
	// set, the record returns to stage back and the sign-offs from there on
	// are dropped.
	approve     bool
	stage       int
	back        int
	needComment bool
	text        string
}

var requestTransitions = map[enum.PurchaseRequestAction]transition[enum.PurchaseRequestStatus]{
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_SUBMIT: {
		key: "submit", role: roleEmployee, from: []enum.PurchaseRequestStatus{reqRework}, to: reqHeadReview,
		text: "Отправил заявку начальнику отдела после доработки",
	},
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_APPROVE: {
		key: "head_approve", role: roleHead, from: []enum.PurchaseRequestStatus{reqHeadReview}, to: reqViceRector,
		approve: true, stage: stHead, text: "Согласовал заявку и передал курирующему проректору",
	},
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_RETURN: {
		key: "head_return", role: roleHead, from: []enum.PurchaseRequestStatus{reqHeadReview}, to: reqRework,
		back: stEmployee, needComment: true, text: "Вернул заявку сотруднику на доработку",
	},
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_REJECT: {
		key: "head_reject", role: roleHead, from: []enum.PurchaseRequestStatus{reqHeadReview}, to: reqRejected,
		needComment: true, text: "Отклонил заявку",
	},
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_APPROVE: {
		key: "vice_rector_approve", role: roleViceRector, from: []enum.PurchaseRequestStatus{reqViceRector}, to: reqImplementer,
		approve: true, stage: stCurator, text: "Согласовал заявку и передал в реализующий отдел",
	},
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_RETURN: {
		key: "vice_rector_return", role: roleViceRector, from: []enum.PurchaseRequestStatus{reqViceRector}, to: reqHeadReview,
		back: stHead, needComment: true, text: "Вернул заявку начальнику отдела",
	},
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_REJECT: {
		key: "vice_rector_reject", role: roleViceRector, from: []enum.PurchaseRequestStatus{reqViceRector}, to: reqRejected,
		needComment: true, text: "Отклонил заявку",
	},
	enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_IMPLEMENTER_RETURN: {
		key: "implementer_return", role: roleHead, from: []enum.PurchaseRequestStatus{reqImplementer}, to: reqViceRector,
		back: stCurator, needComment: true, text: "Вернул заявку проректору",
	},
}

// DISBAND is not here: it deletes the purchase instead of moving it.
var lotTransitions = map[enum.PurchaseLotAction]transition[enum.PurchaseLotStatus]{
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ASSIGN: {
		key: "assign", role: roleHead, from: []enum.PurchaseLotStatus{lotForming}, to: lotSpec,
		approve: true, stage: stImplementer, text: "Передал закупку исполнителю",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SPEC_DONE: {
		key: "spec_done", role: roleEmployee, from: []enum.PurchaseLotStatus{lotSpec}, to: lotCheck,
		approve: true, stage: stSpec, text: "Подготовил характеристики и КП, передал начальнику на проверку",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SPEC_RETURN: {
		key: "spec_return", role: roleEmployee, from: []enum.PurchaseLotStatus{lotSpec}, to: lotForming,
		back: stImplementer, needComment: true, text: "Вернул закупку начальнику",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_CHECK_APPROVE: {
		key: "check_approve", role: roleHead, from: []enum.PurchaseLotStatus{lotCheck}, to: lotViceRector,
		approve: true, stage: stCheck, text: "Проверил работу исполнителя и передал проректору",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_CHECK_RETURN: {
		key: "check_return", role: roleHead, from: []enum.PurchaseLotStatus{lotCheck}, to: lotSpec,
		back: stSpec, needComment: true, text: "Вернул закупку исполнителю на доработку",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST: {
		key: "send_to_economist", role: roleViceRector, from: []enum.PurchaseLotStatus{lotViceRector}, to: lotEconomist,
		approve: true, stage: stLotCurator, text: "Согласовал закупку и передал в экономический отдел",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_VICE_RECTOR_RETURN: {
		key: "vice_rector_return", role: roleViceRector, from: []enum.PurchaseLotStatus{lotViceRector}, to: lotCheck,
		back: stCheck, needComment: true, text: "Вернул закупку реализующему начальнику",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ECONOMIST_APPROVE: {
		key: "economist_approve", role: roleEconomist, from: []enum.PurchaseLotStatus{lotEconomist}, to: lotCommission,
		approve: true, stage: stEconomist, text: "Утвердил бюджет и НМЦК, передал на бюджетную комиссию",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ECONOMIST_RETURN: {
		key: "economist_return", role: roleEconomist, from: []enum.PurchaseLotStatus{lotEconomist}, to: lotViceRector,
		back: stLotCurator, needComment: true, text: "Вернул закупку проректору",
	},
	// The commission may change its mind on a decided purchase.
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_COMMISSION_APPROVE: {
		key: "commission_approve", role: roleCommission, from: []enum.PurchaseLotStatus{lotCommission, lotRejected}, to: lotApproved,
		approve: true, stage: stCommission, text: "Включила закупку в ПФХД",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_COMMISSION_REJECT: {
		key: "commission_reject", role: roleCommission, from: []enum.PurchaseLotStatus{lotCommission, lotApproved}, to: lotRejected,
		needComment: true, text: "Отклонила закупку",
	},
	enum.PurchaseLotAction_PURCHASE_LOT_ACTION_COMMISSION_RETURN: {
		key: "commission_return", role: roleCommission, from: []enum.PurchaseLotStatus{lotCommission}, to: lotEconomist,
		back: stEconomist, needComment: true, text: "Вернула закупку в экономический отдел",
	},
}

// check says whether actor may take t from status, with comment.
func (t transition[S]) check(actor enum.PurchaseActorRole, status S, comment string, statusLabel map[S]string) error {
	if actor != t.role {
		return forbidden("это действие выполняет роль «%s»", roleLabel[t.role])
	}
	if !slices.Contains(t.from, status) {
		return wrongState("сейчас запись %s", statusLabel[status])
	}
	if t.needComment && strings.TrimSpace(comment) == "" {
		return invalid("укажите комментарий — почему")
	}
	return nil
}

// legacyStage places a sign-off stored before stages existed.
func legacyStage(a Approval) int {
	switch a.Role {
	case roleHead:
		return stHead
	case roleViceRector:
		return stCurator
	case roleEconomist:
		return stEconomist
	case roleCommission:
		return stCommission
	}
	return stEmployee
}

func stageOf(a Approval) int {
	if a.Stage != 0 {
		return a.Stage
	}
	return legacyStage(a)
}

// signOff replaces the sign-off of stage with a fresh one.
func signOff(list []Approval, stage int, role enum.PurchaseActorRole, name, comment string, at time.Time) []Approval {
	out := slices.DeleteFunc(slices.Clone(list), func(a Approval) bool { return stageOf(a) == stage })
	return append(out, Approval{Role: role, Stage: stage, Name: name, Comment: comment, At: at})
}

// dropFrom forgets the sign-offs of stage and every later one: the record is
// back there and they must be given again.
func dropFrom(list []Approval, stage int) []Approval {
	return slices.DeleteFunc(slices.Clone(list), func(a Approval) bool { return stageOf(a) >= stage })
}

// applyApprovals moves the sign-offs along t.
func applyApprovals[S comparable](t transition[S], list []Approval, name, comment string, at time.Time) []Approval {
	switch {
	case t.approve:
		return signOff(list, t.stage, t.role, name, comment, at)
	case t.back != 0:
		return dropFrom(list, t.back)
	}
	return list
}

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

// rubOrEmpty is rub, or "не задана" for an unset amount.
func rubOrEmpty(kop int64) string {
	if kop == 0 {
		return "не задана"
	}
	return rub(kop)
}

// qty prints a quantity without a trailing ".0".
func qty(v float64) string {
	return strings.Replace(strconv.FormatFloat(v, 'f', -1, 64), ".", ",", 1)
}

// change collects "field: old → new" for the log.
type change []string

func (c *change) text(label, before, after string) {
	if before != after {
		*c = append(*c, fmt.Sprintf("%s: «%s» → «%s»", label, before, after))
	}
}

func (c change) String() string { return strings.Join(c, "; ") }
