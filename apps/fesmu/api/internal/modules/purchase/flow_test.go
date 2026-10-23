package purchase

import (
	"errors"
	"slices"
	"testing"
	"time"

	enum "dvgmu/api/contract/gen/go/enum/v2"
)

func TestRequestTransitionCheck(t *testing.T) {
	approve := requestTransitions[enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_APPROVE]
	reject := requestTransitions[enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_REJECT]

	cases := []struct {
		name    string
		tr      transition[enum.PurchaseRequestStatus]
		role    enum.PurchaseActorRole
		status  enum.PurchaseRequestStatus
		comment string
		want    error
	}{
		{"head approves under review", approve, roleHead, reqHeadReview, "", nil},
		{"employee cannot approve", approve, roleEmployee, reqHeadReview, "", ErrForbidden},
		{"head cannot approve twice", approve, roleHead, reqViceRector, "", ErrState},
		{"reject needs a reason", reject, roleHead, reqHeadReview, "  ", ErrInvalid},
		{"reject with a reason", reject, roleHead, reqHeadReview, "нет бюджета", nil},
	}
	for _, c := range cases {
		err := c.tr.check(c.role, c.status, c.comment, requestStatusLabel)
		if c.want == nil && err != nil || c.want != nil && !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, err, c.want)
		}
	}
}

func TestEveryTransitionLeadsSomewhereKnown(t *testing.T) {
	for action, tr := range requestTransitions {
		if requestStatusLabel[tr.to] == "" || roleLabel[tr.role] == "" || tr.text == "" || tr.key == "" {
			t.Errorf("request action %v is incomplete", action)
		}
	}
	for action, tr := range lotTransitions {
		if lotStatusLabel[tr.to] == "" || roleLabel[tr.role] == "" || tr.text == "" || tr.key == "" {
			t.Errorf("lot action %v is incomplete", action)
		}
	}
}

// Every working stage can send the record one step back.
func TestEveryStageCanGoBack(t *testing.T) {
	for _, st := range []enum.PurchaseRequestStatus{reqHeadReview, reqViceRector, reqImplementer} {
		ok := false
		for _, tr := range requestTransitions {
			ok = ok || tr.back != 0 && slices.Contains(tr.from, st)
		}
		if !ok {
			t.Errorf("request status %v has no way back", st)
		}
	}
	for _, st := range []enum.PurchaseLotStatus{lotSpec, lotCheck, lotViceRector, lotEconomist, lotCommission} {
		ok := false
		for _, tr := range lotTransitions {
			ok = ok || tr.back != 0 && slices.Contains(tr.from, st)
		}
		if !ok {
			t.Errorf("lot status %v has no way back", st)
		}
	}
}

func TestApprovalsFollowTheFlow(t *testing.T) {
	at := time.Date(2026, 10, 6, 12, 0, 0, 0, time.UTC)
	tr := func(a enum.PurchaseLotAction) transition[enum.PurchaseLotStatus] { return lotTransitions[a] }
	var list []Approval

	// The implementing head signs twice — when assigning and when checking —
	// at two stages, not one role.
	list = applyApprovals(tr(enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ASSIGN), list, "Начальник", "", at)
	list = applyApprovals(tr(enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SPEC_DONE), list, "Исполнитель", "", at)
	list = applyApprovals(tr(enum.PurchaseLotAction_PURCHASE_LOT_ACTION_CHECK_APPROVE), list, "Начальник", "", at)
	list = applyApprovals(tr(enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST), list, "Проректор", "", at)
	if len(list) != 4 {
		t.Fatalf("want 4 sign-offs, got %+v", list)
	}

	// Signing a stage again replaces its sign-off.
	list = applyApprovals(tr(enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST), list, "Проректор 2", "", at)
	if len(list) != 4 || list[len(list)-1].Name != "Проректор 2" {
		t.Fatalf("re-sign-off should replace: %+v", list)
	}

	// The economist returns it to the vice-rector: the vice-rector signs again.
	list = applyApprovals(tr(enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ECONOMIST_RETURN), list, "Экономист", "мало КП", at)
	if len(list) != 3 || stageOf(list[2]) != stCheck {
		t.Fatalf("return to the vice-rector keeps earlier stages: %+v", list)
	}

	// The head returns it to the assignee: the check and the assignee's
	// sign-off go, the assignment stays.
	list = applyApprovals(tr(enum.PurchaseLotAction_PURCHASE_LOT_ACTION_CHECK_RETURN), list, "Начальник", "уточнить", at)
	if len(list) != 1 || stageOf(list[0]) != stImplementer {
		t.Fatalf("return to the assignee: %+v", list)
	}

	// A sign-off stored before stages counts by its role.
	legacy := []Approval{{Role: roleHead}, {Role: roleViceRector}, {Role: roleEconomist}}
	if got := dropFrom(legacy, stCurator); len(got) != 1 || got[0].Role != roleHead {
		t.Fatalf("legacy sign-offs: %+v", got)
	}
}

func TestLotPrice(t *testing.T) {
	l := &Lot{Quantity: 3, Quotations: []Quotation{{UnitPrice: 100_00}, {UnitPrice: 120_00}, {UnitPrice: 110_01}}}
	avg, low, total := l.Price()
	if avg != 110_00 || low != 100_00 || total != 330_00 {
		t.Fatalf("got avg=%d low=%d total=%d", avg, low, total)
	}
	if a, b, c := (&Lot{Quantity: 5}).Price(); a != 0 || b != 0 || c != 0 {
		t.Fatal("no offers, no price")
	}
}

func TestRub(t *testing.T) {
	for kop, want := range map[int64]string{
		0:           "0,00 ₽",
		5:           "0,05 ₽",
		123456789:   "1 234 567,89 ₽",
		-100000:     "-1 000,00 ₽",
		99999999_00: "99 999 999,00 ₽",
	} {
		if got := rub(kop); got != want {
			t.Errorf("rub(%d) = %q, want %q", kop, got, want)
		}
	}
}

func TestSuggestCodes(t *testing.T) {
	cases := map[string]string{
		"Ноутбук для кафедры":             "26.20.11.110",
		"Компьютеры в сборе":              "26.20.15.000",
		"МФУ лазерное":                    "26.20.18.000",
		"Кресло офисное":                  "31.01.11.150",
		"Бумага А4 для принтера":          "17.12.14.110", // the first word decides
		"Стол компьютерный":               "31.01.12",
		"Картридж для МФУ":                "28.23.25.000",
		"Лицензия на антивирус Kaspersky": "58.29.50.000",
	}
	for title, want := range cases {
		got := suggestCodes(title)
		if !got.GetFound() || got.GetOkpd2() != want {
			t.Errorf("%q: got %q, want %q", title, got.GetOkpd2(), want)
		}
		if got.GetOkved() != OkvedOf(want) {
			t.Errorf("%q: ОКВЭД2 %q", title, got.GetOkved())
		}
	}
	if suggestCodes("Что-то непонятное").GetFound() {
		t.Error("unknown title should find nothing")
	}
	if OkvedOf("26.20.15.000") != "26.20" {
		t.Error("okvedOf")
	}
}
