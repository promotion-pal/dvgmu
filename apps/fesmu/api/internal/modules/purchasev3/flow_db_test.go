package purchasev3

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"slices"
	"testing"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	enum "dvgmu/api/contract/gen/go/enum/v3"
	pb "dvgmu/api/contract/gen/go/service/v3"
	"dvgmu/api/internal/auth"
	"dvgmu/api/internal/modules/purchase"
)

// The whole route against a real purchase_db with migrations applied (its
// own database: the v2 tests drop the schema of PURCHASE_TEST_DSN):
//
//	PURCHASE_V3_TEST_DSN="postgres://postgres:pw@localhost:55439/p?sslmode=disable" go test ./internal/modules/purchasev3/
//
// Skipped without PURCHASE_V3_TEST_DSN.

type fakeProfiles []purchase.Employee

func (f fakeProfiles) Employees(context.Context) ([]purchase.Employee, error) { return f, nil }

func TestFlowAgainstDatabase(t *testing.T) {
	dsn := os.Getenv("PURCHASE_V3_TEST_DSN")
	if dsn == "" {
		t.Skip("PURCHASE_V3_TEST_DSN is not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	for _, table := range []string{"purchase_v3_logs", "purchase_v3_documents", "purchase_v3_quotations", "purchase_v3_requests", "purchase_v3_lots", "purchase_v3_protocols"} {
		db.Exec("DELETE FROM " + table)
	}
	// Labs (30) and IT (1) belong to the digital direction, bound to "vr".
	const direction = 6
	db.Exec("UPDATE purchase_v3_curators SET user_uuid = 'vr', user_name = 'Проректор' WHERE id = ?", direction)
	db.Exec("UPDATE purchase_v3_departments SET curator_id = ? WHERE id IN (1, 30)", direction)
	db.Exec("INSERT INTO purchase_v3_categories (name, okpd2_prefix, implementing_department) VALUES ('Компьютеры', '26.20', 1)")

	s := newService(slog.New(slog.NewTextHandler(io.Discard, nil)), &storage{db: db}, fakeProfiles{
		{UUID: "emp", Name: "Иванов И. И.", Department: 30},
		{UUID: "head", Name: "Петров П. П.", Department: 30},
		{UUID: "ithead", Name: "Сидоров С. С.", Department: 1},
		{UUID: "itexec", Name: "Кузнецов К. К.", Department: 1},
		{UUID: "other", Name: "Чужой Ч. Ч.", Department: 55},
	})
	as := func(uuid string, perms ...enum.PurchasePermission) context.Context {
		codes := make([]string, len(perms))
		for i, p := range perms {
			codes[i] = permCode(p)
		}
		return auth.WithUser(context.Background(), &auth.User{UUID: uuid, Username: uuid, Permissions: codes})
	}
	emp := as("emp", permRequestCreate)
	head := as("head", permHeadReview)
	vr := as("vr", permViewDirection, permRequestCurator, permLotCurator)
	ithead := as("ithead", permLotManage)
	itexec := as("itexec", permLotPrepare)
	eco := as("eco", permEconomist)
	commission := as("bk", permCommission)
	contract := as("ks", permContract)
	procurement := as("oz", permProcurement, permAcceptance, permInventory)
	other := as("other", permHeadReview)
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}

	// Stage I: the request.
	id, err := s.RequestCreate(emp, requestInput{title: "Ноутбук для лаборатории", quantity: 2})
	must(err)
	if err := s.RequestMove(other, id, moveForward, "", 0, 0); !errors.Is(err, ErrForbidden) {
		t.Fatalf("head of another department approved: %v", err)
	}
	must(s.RequestMove(head, id, moveReturn, "уточните модель", 0, 0))
	must(s.RequestUpdate(emp, id, requestInput{title: "Ноутбук 14\" для лаборатории", quantity: 2}))
	must(s.RequestMove(emp, id, moveForward, "", 0, 0))
	must(s.RequestMove(head, id, moveForward, "", 0, 0))
	must(s.RequestMove(vr, id, moveForward, "нужно", 0, 0)) // IT, suggested by the category

	lotID, err := s.LotCreate(ithead, []int64{id}, "Ноутбуки", "", 0)
	must(err)
	must(s.LotMove(ithead, lotID, moveForward, "", "itexec"))
	must(s.LotUpdate(itexec, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Content{
		Content: &pb.PurchaseLotContentPatch{Title: "Ноутбуки", Quantity: 2, Specification: "14\", 16 ГБ, SSD 512 ГБ"}}}))
	if err := s.LotMove(itexec, lotID, moveForward, "", ""); !errors.Is(err, ErrInvalid) {
		t.Fatalf("moved on without offers: %v", err)
	}
	_, err = s.QuotationCreate(itexec, lotID, quotationInput{supplier: "ООО А", unitPrice: 90_000_00, content: []byte("pdf"), fileName: "a.pdf"})
	must(err)
	_, err = s.QuotationCreate(itexec, lotID, quotationInput{supplier: "ООО Б", unitPrice: 110_000_00})
	must(err)
	must(s.LotMove(itexec, lotID, moveForward, "", ""))
	must(s.LotMove(ithead, lotID, moveForward, "", "")) // codes were filled from the title
	must(s.LotUpdate(vr, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Curator{
		Curator: &pb.PurchaseLotCuratorPatch{CuratorJustification: "Оснащение лаборатории"}}}))
	must(s.LotMove(vr, lotID, moveForward, "", ""))
	must(s.LotUpdate(eco, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Budget{
		Budget: &pb.PurchaseLotBudgetPatch{Okpd2: "26.20.11.110", FundingSource: enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_INCOME, Kosgu: "310"}}}))
	must(s.LotMove(eco, lotID, moveForward, "", ""))

	// The commission's protocol.
	if err := s.LotMove(commission, lotID, moveForward, "", ""); !errors.Is(err, ErrState) {
		t.Fatalf("commission moved on without a protocol: %v", err)
	}
	_, err = s.ProtocolCreate(commission, protocolInput{number: "1", heldAt: time.Now()}, []*pb.PurchaseProtocolDecisionInput{{
		LotId: lotID, Decision: decisionApprove, PlanType: enum.PurchasePlanType_PURCHASE_PLAN_TYPE_PLANNED, PlanYear: 2027}})
	must(err)

	// Stage II.
	must(s.LotMove(ithead, lotID, moveForward, "", ""))
	must(s.LotUpdate(itexec, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Content{
		Content: &pb.PurchaseLotContentPatch{TechSpec: "Техническое задание"}}}))
	must(s.LotMove(itexec, lotID, moveForward, "", ""))
	must(s.LotMove(ithead, lotID, moveForward, "", ""))
	must(s.LotMove(vr, lotID, moveForward, "", ""))
	must(s.LotUpdate(eco, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_FinalCost{
		FinalCost: &pb.PurchaseLotFinalCostPatch{FinalCost: 195_000_00}}}))
	must(s.LotMove(eco, lotID, moveForward, "", ""))
	must(s.LotUpdate(contract, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Law{
		Law: &pb.PurchaseLotLawPatch{Law: enum.PurchaseLaw_PURCHASE_LAW_FZ44, Method: enum.PurchaseMethod_PURCHASE_METHOD_ELECTRONIC_AUCTION}}}))
	must(s.LotMove(contract, lotID, moveForward, "", ""))

	// Stage III.
	now := timestamppb.Now()
	exec := &pb.PurchaseLotExecutionPatch{NoticeNumber: "0322100000126000001", NoticeAt: now}
	save := func() {
		must(s.LotUpdate(procurement, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Execution{Execution: exec}}))
	}
	save()
	must(s.LotMove(procurement, lotID, moveForward, "", ""))
	exec.Supplier, exec.SupplierInn = "ООО А", "2721000000"
	save()
	must(s.LotMove(procurement, lotID, moveForward, "", ""))
	exec.ContractNumber, exec.ContractAt, exec.ContractAmount = "Ф.2027.1", now, 180_000_00
	save()
	must(s.LotMove(procurement, lotID, moveForward, "", ""))
	exec.DeliveredAt = now
	save()
	must(s.LotMove(procurement, lotID, moveForward, "", ""))
	must(s.LotUpdate(procurement, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Acceptance{
		Acceptance: &pb.PurchaseLotAcceptancePatch{AcceptedAt: now}}}))
	must(s.LotMove(procurement, lotID, moveForward, "", ""))
	must(s.LotUpdate(procurement, &pb.PurchaseLotUpdateRequest{Id: lotID, Patch: &pb.PurchaseLotUpdateRequest_Inventory{
		Inventory: &pb.PurchaseLotInventoryPatch{InventoryNumbers: []string{"ИН-001", "ИН-002", "ИН-001"}}}}))
	must(s.LotMove(procurement, lotID, moveForward, "", ""))

	// What each sees.
	ov, err := s.Overview(vr, 0)
	must(err)
	if len(ov.Lots) != 1 {
		t.Fatalf("vice-rector sees %d purchases", len(ov.Lots))
	}
	l := ov.Lots[0]
	if l.Status != lotCompleted || l.CompletedAt == nil || !slices.Equal(l.InventoryNumbers, []string{"ИН-001", "ИН-002"}) {
		t.Errorf("purchase ended %s, inventory %v", l.Status, l.InventoryNumbers)
	}
	if l.TotalAmount != 195_000_00 || l.Nmck != 200_000_00 {
		t.Errorf("amount %d, НМЦК %d", l.TotalAmount, l.Nmck)
	}
	if len(ov.Protocols) != 0 {
		t.Error("vice-rector without VIEW_PLAN sees protocols")
	}
	if len(ov.Requests[0].GetAllowed().GetMoves()) != 0 {
		t.Error("vice-rector may still move the request")
	}
	if ov, err := s.Overview(other, 0); err != nil || len(ov.Lots) != 0 || len(ov.Requests) != 0 {
		t.Errorf("head of another department sees %d/%d (%v)", len(ov.Requests), len(ov.Lots), err)
	}
	if _, err := s.Overview(as("nobody"), 0); !errors.Is(err, ErrForbidden) {
		t.Errorf("a user without rights opened purchases: %v", err)
	}
	if _, err := s.QuotationFile(other, l.Quotations[0].Id); !errors.Is(err, ErrNotFound) {
		t.Errorf("an outsider downloaded an offer: %v", err)
	}
	if q, err := s.QuotationFile(vr, l.Quotations[0].Id); err != nil || string(q.FileContent) != "pdf" {
		t.Errorf("vice-rector could not download the offer: %v", err)
	}
	if n := len(l.Logs); n < 25 {
		t.Errorf("only %d log entries", n)
	}

	// An administrator is not held up by an unfilled directory: АХУ (55) has
	// no vice-rector, the administrator picks one; nobody else may.
	db.Exec("UPDATE purchase_v3_departments SET curator_id = NULL WHERE id = 55")
	admin := auth.WithUser(context.Background(), &auth.User{UUID: "adm", Username: "adm", Roles: []string{auth.RoleAdmin}})
	ahu, err := s.RequestCreate(admin, requestInput{title: "Стулья", quantity: 10, department: 55})
	must(err)
	if err := s.RequestMove(admin, ahu, moveForward, "", 0, 0); !errors.Is(err, ErrInvalid) {
		t.Fatalf("no direction for АХУ, want a hint to pick one: %v", err)
	}
	if err := s.RequestMove(head, ahu, moveForward, "", 0, direction); !errors.Is(err, ErrForbidden) {
		t.Fatalf("a head picked a direction: %v", err)
	}
	must(s.RequestMove(admin, ahu, moveForward, "", 0, direction))
}
