package purchase

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"

	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"dvgmu/api"
	entity "fesmu/contract/fesmu/entity/v2"
	enum "fesmu/contract/fesmu/enum/v2"
	"dvgmu/api/internal/auth"
)

// newTestService runs the purchase migrations on an empty database given by
// PURCHASE_TEST_DSN, e.g. a throwaway container:
//
//	docker run --rm -d -p 55432:5432 -e POSTGRES_PASSWORD=pass postgres:17
//	PURCHASE_TEST_DSN="host=localhost port=55432 user=postgres password=pass dbname=postgres sslmode=disable" go test ./internal/modules/purchase/
func newTestService(t *testing.T) *Service {
	dsn := os.Getenv("PURCHASE_TEST_DSN")
	if dsn == "" {
		t.Skip("PURCHASE_TEST_DSN is not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	goose.SetBaseFS(api.MigrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	// The database is a throwaway: start every run from nothing.
	if _, err := sqlDB.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public"); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(sqlDB, "migrations/purchase"); err != nil {
		t.Fatal(err)
	}
	return newService(slog.New(slog.NewTextHandler(io.Discard, nil)), &storage{db: db}, nil)
}

func TestFlowEndToEnd(t *testing.T) {
	s := newTestService(t)
	ctx := context.Background()
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	mustIs := func(err, kind error) {
		t.Helper()
		if !errors.Is(err, kind) {
			t.Fatalf("got %v, want %v", err, kind)
		}
	}

	ov, err := s.Overview(ctx)
	must(err)
	if len(ov.Curators) < 2 || len(ov.Departments) != 89 || len(ov.Categories) == 0 {
		t.Fatalf("seeded: %d curators, %d departments, %d categories", len(ov.Curators), len(ov.Departments), len(ov.Categories))
	}
	// The IT department is under one vice-rector, АХУ (55) under another.
	const it, ahu = int32(1), int32(55)
	cur, other := ov.Curators[0].Id, ov.Curators[1].Id
	must(s.store.saveDepartment(ctx, &Department{ID: it, Name: "ИТ-отдел", CuratorID: &cur}))
	must(s.store.saveDepartment(ctx, &Department{ID: ahu, Name: "Административно-хозяйственное управление", CuratorID: &other}))

	employee := actor{role: roleEmployee, name: "Иванов И.", uuid: "u-emp", department: it}
	stranger := actor{role: roleEmployee, name: "Чужой", uuid: "u-x", department: it}
	head := actor{role: roleHead, name: "Петров П.", uuid: "u-head", department: it}
	otherHead := actor{role: roleHead, name: "Сидоров С.", uuid: "u-head2", department: 2}
	vr := actor{role: roleViceRector, name: "Проректор ИТ", uuid: "u-vr", curatorID: cur}
	vrAhu := actor{role: roleViceRector, name: "Проректор АХР", uuid: "u-vr2", curatorID: other}
	ahuHead := actor{role: roleHead, name: "Начальник АХУ", uuid: "u-ahu", department: ahu}
	assignee := actor{role: roleEmployee, name: "Исполнитель", uuid: "u-spec", department: ahu}
	econ := actor{role: roleEconomist, name: "Экономова Э."}
	comm := actor{role: roleCommission, name: "Комиссия"}

	// The request goes to the author's own department; nobody else edits it.
	in := requestInput{title: "Кресло офисное", quantity: 2}
	r1, err := s.RequestCreate(ctx, employee, in)
	must(err)
	in.quantity = 3
	r2, err := s.RequestCreate(ctx, employee, in)
	must(err)
	if r := findRequest(t, s, r1); r.DepartmentId != it || r.AuthorUuid != "u-emp" || r.SuggestedDepartment != ahu {
		t.Fatalf("new request: %+v", r)
	}
	_, err = s.RequestCreate(ctx, actor{role: roleEmployee, uuid: "u-nodep"}, in)
	mustIs(err, ErrInvalid)

	// Head of another department cannot touch it; the own head returns,
	// the author fixes, only the author resubmits.
	mustIs(s.RequestAction(ctx, otherHead, r1, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_APPROVE, "", 0), ErrForbidden)
	must(s.RequestAction(ctx, head, r1, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_RETURN, "уточните модель", 0))
	mustIs(s.RequestAction(ctx, stranger, r1, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_SUBMIT, "", 0), ErrForbidden)
	in.quantity = 4
	must(s.RequestUpdate(ctx, employee, r1, in))
	must(s.RequestAction(ctx, employee, r1, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_SUBMIT, "", 0))

	// Approved by the head, each request goes to the vice-rector over IT.
	for _, id := range []int64{r1, r2} {
		must(s.RequestAction(ctx, head, id, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_APPROVE, "", 0))
	}
	if r := findRequest(t, s, r1); r.CuratorId != cur || r.Status != reqViceRector {
		t.Fatalf("after head: %+v", r)
	}
	mustIs(s.RequestAction(ctx, vrAhu, r1, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_APPROVE, "", 0), ErrForbidden)
	// 0 takes the suggested implementing department (furniture → АХУ).
	for _, id := range []int64{r1, r2} {
		must(s.RequestAction(ctx, vr, id, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_APPROVE, "", 0))
	}
	if r := findRequest(t, s, r2); r.ImplementingDepartment != ahu || r.Status != reqImplementer {
		t.Fatalf("after vice-rector: %+v", r)
	}

	// The implementing head (АХУ, not IT) merges them into a purchase under
	// the vice-rector over АХУ.
	_, err = s.LotCreate(ctx, head, []int64{r1, r2}, "")
	mustIs(err, ErrForbidden)
	lotID, err := s.LotCreate(ctx, ahuHead, []int64{r1, r2}, "Кресла офисные")
	must(err)
	lot := findLot(t, s, lotID)
	if lot.ImplementingDepartment != ahu || lot.CuratorId != other || lot.Quantity != 7 {
		t.Fatalf("lot: %+v", lot)
	}

	// The head gives it to an assignee, who prepares it with offers.
	mustIs(s.LotAction(ctx, ahuHead, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ASSIGN, lotActionInput{}), ErrInvalid)
	must(s.LotAction(ctx, ahuHead, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ASSIGN, lotActionInput{assigneeUUID: "u-spec", assigneeName: "Исполнитель"}))
	_, err = s.QuotationCreate(ctx, stranger, lotID, quotationInput{supplier: "ООО Ноль", unitPrice: 1})
	mustIs(err, ErrForbidden)
	mustIs(s.LotAction(ctx, assignee, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SPEC_DONE, lotActionInput{}), ErrInvalid)
	_, err = s.QuotationCreate(ctx, assignee, lotID, quotationInput{supplier: "ООО Альфа", unitPrice: 10_000_00})
	must(err)
	_, err = s.QuotationCreate(ctx, assignee, lotID, quotationInput{supplier: "ООО Бета", unitPrice: 12_000_00})
	must(err)
	must(s.LotUpdate(ctx, assignee, lotID, lotInput{title: "Кресло офисное эргономичное", description: "Сетчатая спинка", quantity: 7}))
	must(s.LotAction(ctx, assignee, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SPEC_DONE, lotActionInput{}))

	// The head checks: once back, then forward to the vice-rector.
	must(s.LotAction(ctx, ahuHead, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_CHECK_RETURN, lotActionInput{comment: "добавьте гарантию"}))
	must(s.LotAction(ctx, assignee, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SPEC_DONE, lotActionInput{}))
	must(s.LotAction(ctx, ahuHead, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_CHECK_APPROVE, lotActionInput{}))
	if lot = findLot(t, s, lotID); lot.Okpd2 == "" || lot.Status != lotViceRector {
		t.Fatalf("after check: codes %q, status %v", lot.Okpd2, lot.Status)
	}

	// The vice-rector over АХУ, not over IT, approves it.
	mustIs(s.LotAction(ctx, vr, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST, lotActionInput{}), ErrForbidden)
	must(s.LotUpdate(ctx, vrAhu, lotID, lotInput{comment: "Износ мебели"}))
	must(s.LotAction(ctx, vrAhu, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST, lotActionInput{}))

	// The economist returns it to the vice-rector, then it comes back.
	must(s.LotAction(ctx, econ, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ECONOMIST_RETURN, lotActionInput{comment: "уточнить"}))
	if findLot(t, s, lotID).Status != lotViceRector {
		t.Fatal("economist returns to the vice-rector")
	}
	must(s.LotAction(ctx, vrAhu, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_SEND_TO_ECONOMIST, lotActionInput{}))
	lot = findLot(t, s, lotID)
	must(s.LotUpdate(ctx, econ, lotID, lotInput{
		okpd2: lot.Okpd2, ktru: lot.Okpd2 + "-00000001", okved: lot.Okved,
		fundingSource: enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_STATE_TASK, kosgu: "310", nmck: 75_000_00,
	}))
	must(s.LotAction(ctx, econ, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_ECONOMIST_APPROVE, lotActionInput{}))
	must(s.LotAction(ctx, comm, lotID, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_COMMISSION_APPROVE, lotActionInput{
		planType: enum.PurchasePlanType_PURCHASE_PLAN_TYPE_PLANNED, planYear: 2027,
	}))

	lot = findLot(t, s, lotID)
	switch {
	case lot.Status != lotApproved || lot.TotalAmount != 75_000_00 || lot.CalcAmount != 77_000_00:
		t.Fatalf("approved: status %v total %d calc %d", lot.Status, lot.TotalAmount, lot.CalcAmount)
	case len(lot.Approvals) != 6:
		t.Fatalf("sign-offs: assign, spec, check, vice-rector, economist, commission — got %+v", lot.Approvals)
	}
	req := findRequest(t, s, r1)
	// head, vice-rector, implementing head
	if req.Status != reqInLot || req.LotId != lotID || len(req.Approvals) != 3 {
		t.Fatalf("request: %+v", req)
	}

	// The implementing head may send a request back to the vice-rector, and
	// disband a forming purchase: its requests return to the department.
	in.quantity = 1
	r3, err := s.RequestCreate(ctx, employee, in)
	must(err)
	must(s.RequestAction(ctx, head, r3, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_HEAD_APPROVE, "", 0))
	must(s.RequestAction(ctx, vr, r3, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_APPROVE, "", ahu))
	must(s.RequestAction(ctx, ahuHead, r3, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_IMPLEMENTER_RETURN, "не наш профиль", 0))
	if r := findRequest(t, s, r3); r.Status != reqViceRector || len(r.Approvals) != 1 {
		t.Fatalf("returned to vice-rector: %+v", r)
	}
	must(s.RequestAction(ctx, vr, r3, enum.PurchaseRequestAction_PURCHASE_REQUEST_ACTION_VICE_RECTOR_APPROVE, "", ahu))
	lot2, err := s.LotCreate(ctx, ahuHead, []int64{r3}, "")
	must(err)
	must(s.LotAction(ctx, ahuHead, lot2, enum.PurchaseLotAction_PURCHASE_LOT_ACTION_DISBAND, lotActionInput{}))
	if r := findRequest(t, s, r3); r.Status != reqImplementer || r.LotId != 0 {
		t.Fatalf("after disband: %+v", r)
	}

	// Each user sees their own part. Vice-rectors are bound to their users,
	// departments come from MDM.
	third := ov.Curators[2].Id
	for id, uuid := range map[int64]string{cur: "u-vr", other: "u-vr2", third: "u-vr3"} {
		c, err := s.store.curator(ctx, id)
		must(err)
		c.UserUUID = uuid
		must(s.store.saveCurator(ctx, c))
	}
	s.profiles = newProfileCache(fakeProfiles{
		{UUID: "u-emp", Department: it}, {UUID: "u-head", Department: it}, {UUID: "u-head2", Department: 2},
		{UUID: "u-ahu", Department: ahu}, {UUID: "u-spec", Department: ahu},
	})
	sees := func(uuid string, roles []string, sections ...auth.Section) (int, int) {
		t.Helper()
		var perms []string
		for _, sec := range sections {
			perms = append(perms, auth.Perm(sec, auth.ActionFetch))
		}
		ov, err := s.Overview(auth.WithUser(ctx, &auth.User{UUID: uuid, Roles: roles, Permissions: perms}))
		must(err)
		return len(ov.Requests), len(ov.Lots)
	}
	for _, c := range []struct {
		name           string
		uuid           string
		roles          []string
		sections       []auth.Section
		requests, lots int
	}{
		{"vice-rector over IT: its requests and the purchase holding them", "u-vr", nil, []auth.Section{auth.SectionPurchaseViceRector}, 3, 1},
		{"vice-rector over АХУ: the purchase it curates", "u-vr2", nil, []auth.Section{auth.SectionPurchaseViceRector}, 2, 1},
		{"vice-rector without departments: nothing", "u-vr3", nil, []auth.Section{auth.SectionPurchaseViceRector}, 0, 0},
		{"head of another department: nothing", "u-head2", nil, []auth.Section{auth.SectionPurchaseHead}, 0, 0},
		{"implementing head: what АХУ carries out", "u-ahu", nil, []auth.Section{auth.SectionPurchaseHead}, 3, 1},
		{"author: own requests and their purchase", "u-emp", nil, []auth.Section{auth.SectionPurchaseRequest}, 3, 1},
		{"economist: all", "u-x", nil, []auth.Section{auth.SectionPurchaseEconomist}, 3, 1},
		{"admin: all", "u-admin", []string{auth.RoleAdmin}, nil, 3, 1},
	} {
		if r, l := sees(c.uuid, c.roles, c.sections...); r != c.requests || l != c.lots {
			t.Errorf("%s: sees %d requests, %d lots; want %d, %d", c.name, r, l, c.requests, c.lots)
		}
	}
}

type fakeProfiles []Employee

func (f fakeProfiles) Employees(context.Context) ([]Employee, error) { return f, nil }

func findLot(t *testing.T, s *Service, id int64) *entity.PurchaseLot {
	t.Helper()
	ov, err := s.Overview(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, l := range ov.Lots {
		if l.Id == id {
			return l
		}
	}
	t.Fatalf("lot %d not found", id)
	return nil
}

func findRequest(t *testing.T, s *Service, id int64) *entity.PurchaseRequest {
	t.Helper()
	ov, err := s.Overview(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range ov.Requests {
		if r.Id == id {
			return r
		}
	}
	t.Fatalf("request %d not found", id)
	return nil
}
