package debtor

import (
	"context"
	"log/slog"
	"regexp"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
	"google.golang.org/protobuf/types/known/timestamppb"

	entity "dvgmu/api/contract/gen/go/entity/v1"
	enum "dvgmu/api/contract/gen/go/enum/v1"
	pb "dvgmu/api/contract/gen/go/service/v1"
	onec "dvgmu/api/internal/utils/1c"
)

const dateLayout = "2006-01-02"

// Source is what the service needs from 1C; *onec.Accounting satisfies it,
// and tests can substitute a fake.
type Source interface {
	TuitionTurnover(ctx context.Context, from, to time.Time) ([]onec.ContractTurnover, error)
	TuitionSchedules(ctx context.Context) (map[string][]onec.Payment, error)
	TuitionReceipts(ctx context.Context) (map[string]onec.Receipt, error)
	TuitionOperations(ctx context.Context, contractRef string) ([]onec.Operation, error)
	KindByINN() bool
	Diagnose(ctx context.Context, withMetadata bool) []onec.DiagSection
}

type Service struct {
	log    *slog.Logger
	source Source // nil when 1C is not configured
	db     string
	now    func() time.Time
	group  singleflight.Group
}

func newService(log *slog.Logger, source Source, db string) *Service {
	return &Service{log: log, source: source, db: db, now: time.Now}
}

// Fetch reads the period's turnovers from 1C. Calls for the same period that
// arrive while a read is in flight get that read's result, so the data is
// never older than the call.
func (s *Service) Fetch(ctx context.Context, req *pb.DebtorFetchRequest) (*pb.DebtorFetchResponse, error) {
	if s.source == nil {
		return nil, ErrNotConfigured
	}
	from, to, err := s.period(req.GetDateFrom(), req.GetDateTo())
	if err != nil {
		return nil, err
	}

	// The shared read must not die with whichever caller started it.
	key := from.Format(dateLayout) + "|" + to.Format(dateLayout)
	ch := s.group.DoChan(key, func() (any, error) {
		return s.fetch(context.WithoutCancel(ctx), from, to)
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case r := <-ch:
		if r.Err != nil {
			return nil, r.Err
		}
		return r.Val.(*pb.DebtorFetchResponse), nil
	}
}

// period parses the bounds and widens them to whole months: from → first day
// of its month, to → first day of its month (the last month is included).
func (s *Service) period(fromStr, toStr string) (from, to time.Time, err error) {
	now := s.now()
	from = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	to = now
	if fromStr != "" {
		if from, err = time.Parse(dateLayout, fromStr); err != nil {
			return from, to, invalid("дата «с» не в формате ГГГГ-ММ-ДД: %q", fromStr)
		}
	}
	if toStr != "" {
		if to, err = time.Parse(dateLayout, toStr); err != nil {
			return from, to, invalid("дата «по» не в формате ГГГГ-ММ-ДД: %q", toStr)
		}
	}
	from, to = onec.MonthStart(from), onec.MonthStart(to)
	if to.Before(from) {
		return from, to, invalid("дата «с» позже даты «по»")
	}
	if from.Year() < 2000 || to.Year() > 2999 {
		return from, to, invalid("период вне допустимого диапазона")
	}
	return from, to, nil
}

func (s *Service) fetch(ctx context.Context, from, to time.Time) (*pb.DebtorFetchResponse, error) {
	start := s.now()

	// Three independent 1C reads, each a WinRM round trip of a few seconds —
	// run them side by side. Schedules and receipts only enrich the
	// turnovers: if 1C fails to give them, the page still gets the balances
	// and says what is missing.
	var (
		wg                    sync.WaitGroup
		rows                  []onec.ContractTurnover
		schedules             map[string][]onec.Payment
		receipts              map[string]onec.Receipt
		err, schErr, recptErr error
	)
	wg.Add(3)
	go func() { defer wg.Done(); rows, err = s.source.TuitionTurnover(ctx, from, to) }()
	go func() { defer wg.Done(); schedules, schErr = s.source.TuitionSchedules(ctx) }()
	go func() { defer wg.Done(); receipts, recptErr = s.source.TuitionReceipts(ctx) }()
	wg.Wait()

	if err != nil {
		s.log.Error("1c tuition turnover read failed", "error", err)
		return nil, err
	}
	if schErr != nil {
		s.log.Error("1c payment schedules read failed", "error", schErr)
	} else {
		payments := 0
		for _, plan := range schedules {
			payments += len(plan)
		}
		s.log.Info("1c payment schedules read", "contracts", len(schedules), "payments", payments)
	}
	if recptErr != nil {
		s.log.Error("1c receipts read failed", "error", recptErr)
	}
	scheduleErr, receiptErr := errText(schErr), errText(recptErr)
	today := s.now()

	resp := &pb.DebtorFetchResponse{
		ScheduleError: scheduleErr,
		ReceiptError:  receiptErr,
		Debtors:       make([]*entity.Debtor, 0, len(rows)),
		FetchedAt:     timestamppb.New(s.now()),
		Source:        s.db,
		PeriodFrom:    from.Format(dateLayout),
		PeriodTo:      to.AddDate(0, 1, -1).Format(dateLayout), // last day of the last month
		KindByInn:     s.source.KindByINN(),
	}
	for _, r := range rows {
		d := &entity.Debtor{
			Kontragent:  r.Kontragent,
			Contract:    r.Dogovor,
			Inn:         r.INN,
			Kind:        kindToProto(r.Kind),
			Opening:     r.Opening,
			Debit:       r.Debit,
			Credit:      r.Credit,
			Closing:     r.Closing,
			Current:     r.Current,
			ContractRef: r.ContractRef,
		}
		if plan, ok := schedules[r.ContractRef]; ok && len(plan) > 0 {
			d.HasSchedule = true
			d.DueNow = onec.DueNow(r.Current, plan, today)
			for _, p := range plan {
				d.Schedule = append(d.Schedule, &entity.DebtorPayment{Until: p.Until.Format(dateLayout), Amount: p.Amount})
			}
		}
		if rc, ok := receipts[r.ContractRef]; ok {
			d.Receipt = &entity.DebtorReceipt{
				Number:     rc.Number,
				Date:       dateOrEmpty(rc.Date),
				Amount:     rc.Amount,
				ValidUntil: dateOrEmpty(rc.ValidUntil),
				Uin:        rc.UIN,
				Purpose:    rc.Purpose,
			}
		}
		resp.Debtors = append(resp.Debtors, d)
	}
	s.log.Info("1c tuition turnover read", "count", len(resp.Debtors),
		"from", resp.PeriodFrom, "to", resp.PeriodTo, "took", s.now().Sub(start))
	return resp, nil
}

func kindToProto(k onec.KontragentKind) enum.DebtorKind {
	switch k {
	case onec.KindPerson:
		return enum.DebtorKind_DEBTOR_KIND_PERSON
	case onec.KindOrganization:
		return enum.DebtorKind_DEBTOR_KIND_ORGANIZATION
	}
	return enum.DebtorKind_DEBTOR_KIND_UNSPECIFIED
}

// diagnoseTimeout bounds a whole diagnostics run; onec's own per-probe
// limits add up to less, this is the backstop.
var diagnoseTimeout = 12 * time.Minute

// Diagnose runs 1C's diagnostics report. A second call while one runs waits
// for the same report instead of starting another multi-minute scan.
func (s *Service) Diagnose(ctx context.Context, withMetadata bool) (*pb.DebtorDiagnoseResponse, error) {
	if s.source == nil {
		return nil, ErrNotConfigured
	}
	key := "diagnose"
	if withMetadata {
		key = "diagnose+metadata"
	}
	ch := s.group.DoChan(key, func() (any, error) {
		// Detached from the caller (a closed tab must not cancel a report others
		// wait on) but bounded: a stuck run must not hold every later call forever.
		dctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), diagnoseTimeout)
		defer cancel()
		start := s.now()
		s.log.Info("1c diagnose started")
		sections := s.source.Diagnose(dctx, withMetadata)
		resp := &pb.DebtorDiagnoseResponse{FinishedAt: timestamppb.New(s.now())}
		failed := 0
		for _, d := range sections {
			sec := &pb.DiagnoseSection{Title: d.Title, Columns: d.Columns, Error: d.Err}
			for _, r := range d.Rows {
				sec.Rows = append(sec.Rows, &pb.DiagnoseRow{Cells: r})
			}
			if d.Err != "" {
				failed++
				s.log.Warn("1c diagnose probe failed", "probe", d.Title, "error", d.Err)
			}
			resp.Sections = append(resp.Sections, sec)
		}
		s.log.Info("1c diagnose finished", "sections", len(resp.Sections), "failed", failed, "took", s.now().Sub(start))
		return resp, nil
	})
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case r := <-ch:
		return r.Val.(*pb.DebtorDiagnoseResponse), r.Err
	}
}

func errText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

// dateOrEmpty — «YYYY-MM-DD» или пусто для нулевой даты.
func dateOrEmpty(t time.Time) string {
	if t.IsZero() {
		return ""
	}
	return t.Format(dateLayout)
}

// Operations — все проводки по 205.31 для одного договора: начисления и
// оплаты с точными датами и документами.
func (s *Service) Operations(ctx context.Context, contractRef string) (*pb.DebtorOperationsResponse, error) {
	if s.source == nil {
		return nil, ErrNotConfigured
	}
	if !reContractRef.MatchString(contractRef) {
		return nil, invalid("некорректная ссылка на договор")
	}
	ops, err := s.source.TuitionOperations(ctx, contractRef)
	if err != nil {
		s.log.Error("1c contract operations read failed", "error", err)
		return nil, err
	}
	resp := &pb.DebtorOperationsResponse{Operations: make([]*entity.DebtorOperation, 0, len(ops))}
	for _, op := range ops {
		resp.Operations = append(resp.Operations, &entity.DebtorOperation{
			Date:     op.Date.Format(dateLayout),
			Document: op.Document,
			Number:   op.Number,
			Debit:    op.Debit,
			Credit:   op.Credit,
		})
	}
	return resp, nil
}

// reContractRef — как onec: «0x» + 32 hex; плохой ввод — InvalidArgument, а
// не ошибка 1С.
var reContractRef = regexp.MustCompile(`^0x[0-9A-Fa-f]{32}$`)
