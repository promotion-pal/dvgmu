package debtor

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	enum "dvgmu/api/contract/gen/go/enum/v1"
	pb "dvgmu/api/contract/gen/go/service/v1"
	onec "dvgmu/api/internal/utils/1c"
)

type fakeSource struct {
	schedules   map[string][]onec.Payment
	receipts    map[string]onec.Receipt
	scheduleErr error
	hang        bool // Diagnose blocks until its context ends
	calls       atomic.Int32
	release     chan struct{}
	rows        []onec.ContractTurnover
	err         error
	mu          sync.Mutex
	from, to    time.Time
}

func (f *fakeSource) TuitionTurnover(_ context.Context, from, to time.Time) ([]onec.ContractTurnover, error) {
	f.calls.Add(1)
	f.mu.Lock()
	f.from, f.to = from, to
	f.mu.Unlock()
	if f.release != nil {
		<-f.release
	}
	return f.rows, f.err
}

func (f *fakeSource) KindByINN() bool { return false }

func (f *fakeSource) TuitionSchedules(context.Context) (map[string][]onec.Payment, error) {
	return f.schedules, f.scheduleErr
}

func (f *fakeSource) TuitionReceipts(context.Context) (map[string]onec.Receipt, error) {
	return f.receipts, nil
}

func (f *fakeSource) TuitionOperations(_ context.Context, ref string) ([]onec.Operation, error) {
	return []onec.Operation{
		{Date: time.Date(2026, 8, 6, 0, 0, 0, 0, time.UTC), Document: "Документ.НачислениеЗаУслугиОбразования", Number: "00-123", Debit: 2280000},
		{Date: time.Date(2026, 8, 20, 0, 0, 0, 0, time.UTC), Document: "_Document900", Credit: 190000},
	}, nil
}

func (f *fakeSource) Diagnose(ctx context.Context, _ bool) []onec.DiagSection {
	if f.hang {
		<-ctx.Done()
		return []onec.DiagSection{{Title: "hung", Err: ctx.Err().Error()}}
	}
	return []onec.DiagSection{
		{Title: "ok", Columns: []string{"a", "b"}, Rows: [][]string{{"1", "2"}}},
		{Title: "failed", Err: "boom"},
	}
}

func testLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// testService is pinned to 2026-09-28 so default periods are predictable.
func testService(src Source) *Service {
	s := newService(testLog(), src, "bgu2")
	s.now = func() time.Time { return time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC) }
	return s
}

func req(from, to string) *pb.DebtorFetchRequest {
	return &pb.DebtorFetchRequest{DateFrom: from, DateTo: to}
}

func TestFetchMapsRows(t *testing.T) {
	src := &fakeSource{rows: []onec.ContractTurnover{
		{Kontragent: "Иванов И.И.", Dogovor: "Договор 1", Kind: onec.KindPerson, Opening: 100, Debit: 50, Credit: 30, Closing: 120},
		{Kontragent: `ООО "Ромашка"`, Dogovor: "Договор 2", Kind: onec.KindOrganization, Closing: 10},
	}}
	resp, err := testService(src).Fetch(context.Background(), req("", ""))
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Debtors) != 2 || resp.Source != "bgu2" || resp.FetchedAt == nil {
		t.Fatalf("unexpected response: %+v", resp)
	}
	d := resp.Debtors[0]
	if d.Opening != 100 || d.Debit != 50 || d.Credit != 30 || d.Closing != 120 || d.Kind != enum.DebtorKind_DEBTOR_KIND_PERSON {
		t.Fatalf("unexpected first row: %+v", d)
	}
	if resp.Debtors[1].Kind != enum.DebtorKind_DEBTOR_KIND_ORGANIZATION {
		t.Fatalf("second row kind: %v", resp.Debtors[1].Kind)
	}
}

func TestFetchPeriod(t *testing.T) {
	cases := []struct {
		from, to         string
		wantFrom, wantTo string // response period, whole months
	}{
		{"", "", "2026-01-01", "2026-09-30"},                     // default: this year to date
		{"2026-02-15", "2026-03-03", "2026-02-01", "2026-03-31"}, // widened to months
		{"2025-12-01", "2026-02-28", "2025-12-01", "2026-02-28"},
	}
	for _, c := range cases {
		src := &fakeSource{}
		resp, err := testService(src).Fetch(context.Background(), req(c.from, c.to))
		if err != nil {
			t.Fatal(err)
		}
		if resp.PeriodFrom != c.wantFrom || resp.PeriodTo != c.wantTo {
			t.Errorf("%s..%s: got %s..%s, want %s..%s", c.from, c.to, resp.PeriodFrom, resp.PeriodTo, c.wantFrom, c.wantTo)
		}
		if src.from.Format(dateLayout) != c.wantFrom {
			t.Errorf("source got from %s", src.from)
		}
	}
}

func TestFetchInvalidPeriod(t *testing.T) {
	for _, r := range []*pb.DebtorFetchRequest{req("2026-05-01", "2026-03-01"), req("01.01.2026", ""), req("", "garbage")} {
		if _, err := testService(&fakeSource{}).Fetch(context.Background(), r); !errors.Is(err, ErrInvalid) {
			t.Errorf("%v: want ErrInvalid, got %v", r, err)
		}
	}
}

func TestFetchReadsSourceEveryCall(t *testing.T) {
	src := &fakeSource{}
	s := testService(src)
	for range 3 {
		if _, err := s.Fetch(context.Background(), req("", "")); err != nil {
			t.Fatal(err)
		}
	}
	if n := src.calls.Load(); n != 3 {
		t.Fatalf("sequential calls must each hit 1C (no cache), got %d reads", n)
	}
}

func TestFetchSharesConcurrentReadOfSamePeriod(t *testing.T) {
	src := &fakeSource{release: make(chan struct{})}
	s := testService(src)

	var wg sync.WaitGroup
	for range 5 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := s.Fetch(context.Background(), req("2026-01-01", "2026-06-30")); err != nil {
				t.Error(err)
			}
		}()
	}
	time.Sleep(50 * time.Millisecond) // let all callers join the in-flight read
	close(src.release)
	wg.Wait()

	if n := src.calls.Load(); n != 1 {
		t.Fatalf("concurrent calls must share one 1C read, got %d", n)
	}
}

func TestFetchNotConfigured(t *testing.T) {
	_, err := newService(testLog(), nil, "").Fetch(context.Background(), req("", ""))
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("want ErrNotConfigured, got %v", err)
	}
}

func TestFetchSourceError(t *testing.T) {
	boom := errors.New("winrm down")
	_, err := testService(&fakeSource{err: boom}).Fetch(context.Background(), req("", ""))
	if !errors.Is(err, boom) {
		t.Fatalf("want source error, got %v", err)
	}
}

func TestSchemaFor(t *testing.T) {
	for _, db := range []string{"bgu2", "bgu2025", "bgu2017", "test", "бгу2022"} {
		if _, err := onec.SchemaFor(db); err != nil {
			t.Errorf("%s: %v", db, err)
		}
	}
	for _, db := range []string{"bgu", "zgu_copy_2025", ""} {
		if _, err := onec.SchemaFor(db); err == nil {
			t.Errorf("%s: want error", db)
		}
	}
}

func TestDiagnoseMapsSections(t *testing.T) {
	resp, err := testService(&fakeSource{}).Diagnose(context.Background(), false)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Sections) != 2 || resp.FinishedAt == nil {
		t.Fatalf("unexpected: %+v", resp)
	}
	if ok := resp.Sections[0]; ok.Title != "ok" || len(ok.Rows) != 1 || ok.Rows[0].Cells[1] != "2" {
		t.Fatalf("ok section: %+v", ok)
	}
	if failed := resp.Sections[1]; failed.Error != "boom" {
		t.Fatalf("failed section: %+v", failed)
	}
}

func TestDiagnoseNotConfigured(t *testing.T) {
	if _, err := newService(testLog(), nil, "").Diagnose(context.Background(), false); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("want ErrNotConfigured, got %v", err)
	}
}

func TestDiagnoseStuckSourceIsBounded(t *testing.T) {
	old := diagnoseTimeout
	diagnoseTimeout = 100 * time.Millisecond
	defer func() { diagnoseTimeout = old }()

	s := testService(&fakeSource{hang: true})
	done := make(chan *pb.DebtorDiagnoseResponse, 1)
	go func() {
		resp, _ := s.Diagnose(context.Background(), false)
		done <- resp
	}()
	select {
	case resp := <-done:
		if len(resp.Sections) != 1 || resp.Sections[0].Error == "" {
			t.Fatalf("stuck run must end with an error section: %+v", resp)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Diagnose hung on a stuck source")
	}

	// The next call starts fresh instead of joining the stuck one forever.
	if _, err := s.Diagnose(context.Background(), false); err != nil {
		t.Fatal(err)
	}
}

func TestFetchDueNowAndReceipt(t *testing.T) {
	day := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }
	src := &fakeSource{
		rows: []onec.ContractTurnover{
			{Kontragent: "Ли Луси", Dogovor: "Договор № 49/26", Current: 1900000, Closing: 1900000, ContractRef: "0xA"},
			{Kontragent: "Без графика", Dogovor: "Договор № 1/20", Current: 50000, Closing: 50000, ContractRef: "0xB"},
		},
		schedules: map[string][]onec.Payment{"0xA": {
			{Until: day(2026, 9, 1), Amount: 380000},
			{Until: day(2027, 9, 1), Amount: 380000},
			{Until: day(2028, 9, 1), Amount: 380000},
			{Until: day(2029, 9, 1), Amount: 380000},
			{Until: day(2030, 9, 1), Amount: 380000},
			{Until: day(2031, 9, 1), Amount: 380000},
		}},
		receipts: map[string]onec.Receipt{"0xA": {Number: "К-15", Date: day(2026, 8, 20), Amount: 380000, UIN: "0316373123456789"}},
	}
	resp, err := testService(src).Fetch(context.Background(), req("", ""))
	if err != nil {
		t.Fatal(err)
	}
	a, b := resp.Debtors[0], resp.Debtors[1]
	// 1 900 000 left, five future payments of 380 000 = 1 900 000 → nothing due now.
	if !a.HasSchedule || a.DueNow != 0 || len(a.Schedule) != 6 || a.Schedule[0].Until != "2026-09-01" {
		t.Fatalf("A: %+v", a)
	}
	if a.Receipt == nil || a.Receipt.Uin != "0316373123456789" || a.Receipt.Date != "2026-08-20" || a.Receipt.ValidUntil != "" {
		t.Fatalf("A receipt: %+v", a.Receipt)
	}
	if b.HasSchedule || b.DueNow != 0 || b.Receipt != nil || b.Current != 50000 {
		t.Fatalf("B without a schedule: %+v", b)
	}
}

func TestFetchScheduleErrorKeepsTurnovers(t *testing.T) {
	src := &fakeSource{
		rows:        []onec.ContractTurnover{{Kontragent: "Иванов", Current: 100, Closing: 100, ContractRef: "0xA"}},
		scheduleErr: errors.New("колонка не найдена"),
	}
	resp, err := testService(src).Fetch(context.Background(), req("", ""))
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Debtors) != 1 || resp.ScheduleError == "" || resp.Debtors[0].HasSchedule {
		t.Fatalf("unexpected: %+v", resp)
	}
}

func TestOperations(t *testing.T) {
	s := testService(&fakeSource{})
	if _, err := s.Operations(context.Background(), "0x12; DROP"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("bad ref must be ErrInvalid, got %v", err)
	}
	resp, err := s.Operations(context.Background(), "0x"+strings.Repeat("AB", 16))
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Operations) != 2 || resp.Operations[0].Date != "2026-08-06" || resp.Operations[0].Debit != 2280000 || resp.Operations[1].Credit != 190000 {
		t.Fatalf("unexpected: %+v", resp.Operations)
	}
}
