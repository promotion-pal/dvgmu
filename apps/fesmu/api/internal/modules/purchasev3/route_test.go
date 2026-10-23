package purchasev3

import (
	"errors"
	"testing"
	"time"

	enum "dvgmu/api/contract/gen/go/enum/v3"
)

// Every stage leads somewhere that is itself on the route or final, and
// returns to the stage just before it.
func TestLotRouteIsConnected(t *testing.T) {
	final := map[enum.PurchaseLotStatus]bool{lotCompleted: true}
	for i, st := range lotRoute {
		if st.next != 0 && !final[st.next] {
			if _, _, ok := stageOf(lotRoute, st.next); !ok {
				t.Errorf("%s: next %s is not on the route", st.status, st.next)
			}
		}
		if st.prev != 0 {
			_, j, ok := stageOf(lotRoute, st.prev)
			if !ok || j != i-1 {
				t.Errorf("%s: returns to %s, not to the stage before it", st.status, st.prev)
			}
		}
		if st.next != 0 && st.forward == "" {
			t.Errorf("%s: no log text for FORWARD", st.status)
		}
		if roleLabel[st.role] == "" || permLabel[st.perm] == "" {
			t.Errorf("%s: unlabelled role or right", st.status)
		}
	}
	for status := range enum.PurchaseLotStatus_name {
		s := enum.PurchaseLotStatus(status)
		if s != 0 && lotStatusLabel[s] == "" {
			t.Errorf("%s has no label", s)
		}
	}
}

// Walks a product purchase through the whole route, filling each stage's
// fields only when the stage says they are missing.
func TestLotWalksTheWholeRoute(t *testing.T) {
	now := time.Date(2026, 10, 16, 10, 0, 0, 0, time.UTC)
	l := &Lot{Title: "Ноутбук", Quantity: 2, ItemType: itemProduct, Status: lotForming}
	fill := map[enum.PurchaseLotStatus]func(){
		lotForming:         func() { l.AssigneeUUID, l.AssigneeName = "u2", "Исполнитель" },
		lotSpecification:   func() { l.Specification = "14\", 16 ГБ"; l.Quotations = []Quotation{{UnitPrice: 100_000_00}} },
		lotCuratorReview:   func() { l.CuratorJustification = "Замена устаревшей техники" },
		lotEconomistReview: func() { l.FundingSource, l.Kosgu = enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_INCOME, "310" },
		lotTechSpec:        func() { l.TechSpec = "ТЗ" },
		lotFinalCost:       func() { l.FinalCost = 190_000_00 },
		lotContractService: func() {
			l.Law, l.Method = enum.PurchaseLaw_PURCHASE_LAW_FZ44, enum.PurchaseMethod_PURCHASE_METHOD_ELECTRONIC_AUCTION
		},
		lotProcurement:   func() { l.NoticeNumber = "0322100000126000001" },
		lotTendering:     func() { l.Supplier = "ООО Техника" },
		lotContracting:   func() { l.ContractNumber, l.ContractAt, l.ContractAmount = "1", &now, 180_000_00 },
		lotDelivery:      func() { l.DeliveredAt = &now },
		lotAcceptance:    func() { l.AcceptedAt = &now },
		lotInventory:     func() { l.InventoryNumbers = []string{"ИН-1", "ИН-2"} },
		lotApproved:      func() {},
		lotSpecCheck:     func() {},
		lotTechSpecCheck: func() {},
	}
	var walked []enum.PurchaseLotStatus
	for steps := 0; l.Status != lotCompleted; steps++ {
		if steps > 40 {
			t.Fatalf("stuck at %s", l.Status)
		}
		walked = append(walked, l.Status)
		if l.Status == lotCommission {
			l.Status = lotApproved // the protocol's decision
			continue
		}
		st, _, ok := stageOf(lotRoute, l.Status)
		if !ok {
			t.Fatalf("%s is off the route", l.Status)
		}
		if err := lotReady(l); err != nil {
			if f := fill[l.Status]; f != nil {
				f()
			}
			if err := lotReady(l); err != nil {
				t.Fatalf("%s: still not ready: %v", l.Status, err)
			}
		}
		next := nextLot(l, st)
		if next == lotSpecCheck {
			fillCodes(l)
		}
		l.Status = next
	}
	if l.Okpd2 != "26.20.11.110" || !l.CodesAuto {
		t.Errorf("codes not filled from the title: %q auto=%v", l.Okpd2, l.CodesAuto)
	}
	if len(walked) != len(lotRoute) {
		t.Errorf("walked %d stages, the route has %d", len(walked), len(lotRoute))
	}
}

func TestServiceSkipsInventory(t *testing.T) {
	st, _, _ := stageOf(lotRoute, lotAcceptance)
	if got := nextLot(&Lot{ItemType: itemService}, st); got != lotCompleted {
		t.Errorf("service after acceptance → %s, want COMPLETED", got)
	}
	if got := nextLot(&Lot{ItemType: itemProduct}, st); got != lotInventory {
		t.Errorf("product after acceptance → %s, want INVENTORY", got)
	}
}

func TestReadyBlocks(t *testing.T) {
	cases := []struct {
		name string
		lot  Lot
	}{
		{"no assignee", Lot{Status: lotForming}},
		{"no offers", Lot{Status: lotSpecification, Specification: "x"}},
		{"no justification", Lot{Status: lotCuratorReview}},
		{"no funding", Lot{Status: lotEconomistReview, Kosgu: "310", Okpd2: "1", Nmck: 1}},
		{"no ТЗ", Lot{Status: lotTechSpec}},
		{"no notice", Lot{Status: lotProcurement, Method: enum.PurchaseMethod_PURCHASE_METHOD_ELECTRONIC_AUCTION}},
		{"no inventory numbers", Lot{Status: lotInventory}},
	}
	for _, c := range cases {
		if err := lotReady(&c.lot); !errors.Is(err, ErrInvalid) {
			t.Errorf("%s: want ErrInvalid, got %v", c.name, err)
		}
	}
	single := Lot{Status: lotProcurement, Method: enum.PurchaseMethod_PURCHASE_METHOD_SINGLE_SUPPLIER}
	if err := lotReady(&single); err != nil {
		t.Errorf("single supplier needs no notice: %v", err)
	}
	ts := Lot{Status: lotTechSpec, Documents: []Document{{Kind: enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_TECH_SPEC}}}
	if err := lotReady(&ts); err != nil {
		t.Errorf("ТЗ as a file is enough: %v", err)
	}
}

// Returning drops the sign-offs of the stage returned to and every later one.
func TestReturnDropsLaterSignOffs(t *testing.T) {
	list := []SignOff{
		{Stage: int32(lotForming)}, {Stage: int32(lotSpecification)},
		{Stage: int32(lotSpecCheck)}, {Stage: int32(lotCuratorReview)},
	}
	got := dropFrom(list, lotRoute, order(lotRoute, lotSpecification))
	if len(got) != 1 || got[0].Stage != int32(lotForming) {
		t.Errorf("kept %v, want FORMING only", got)
	}
	again := signOff(got, SignOff{Stage: int32(lotForming), Name: "new"})
	if len(again) != 1 || again[0].Name != "new" {
		t.Errorf("signOff must replace the stage's sign-off: %v", again)
	}
}

func TestPrice(t *testing.T) {
	l := &Lot{Quantity: 3, Quotations: []Quotation{{UnitPrice: 100}, {UnitPrice: 200}, {UnitPrice: 300}}}
	avg, low, total, variation := l.Price()
	if avg != 200 || low != 100 || total != 600 {
		t.Errorf("avg %d low %d total %d", avg, low, total)
	}
	if variation != 40.8 {
		t.Errorf("variation %v, want 40.8", variation)
	}
	l.Nmck = 550
	if l.Amount() != 550 {
		t.Error("НМЦК beats the average")
	}
	l.FinalCost = 500
	if l.Amount() != 500 {
		t.Error("final cost beats НМЦК")
	}
}

func TestStageTerms(t *testing.T) {
	fri := time.Date(2026, 10, 16, 15, 0, 0, 0, time.UTC)
	if got := addWorkdays(fri, 3); got.Weekday() != time.Wednesday || got.Day() != 21 {
		t.Errorf("Friday + 3 working days = %s, want Wednesday 21st", got.Format("Mon 02"))
	}
	for _, st := range lotRoute {
		if st.days == 0 {
			t.Errorf("%s has no term", st.status)
		}
	}
	l := &Lot{Status: lotCuratorReview, StageSince: &fri}
	if due := lotStageDue(l); due == nil || due.Day() != 21 {
		t.Errorf("curator review due %v", due)
	}
	contract := fri.AddDate(0, 2, 0)
	l = &Lot{Status: lotDelivery, StageSince: &fri, DeliveryDue: &contract}
	if due := lotStageDue(l); due == nil || !due.Equal(contract) {
		t.Errorf("delivery is due by the contract, got %v", due)
	}
	if lotStageDue(&Lot{Status: lotCompleted, StageSince: &fri}) != nil {
		t.Error("a completed purchase has no stage term")
	}
}
