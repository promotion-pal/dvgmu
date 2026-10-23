package purchasev3

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	enum "dvgmu/api/contract/gen/go/enum/v3"
	pb "dvgmu/api/contract/gen/go/service/v3"
)

const (
	decisionApprove = enum.PurchaseCommissionDecision_PURCHASE_COMMISSION_DECISION_APPROVE
	decisionReject  = enum.PurchaseCommissionDecision_PURCHASE_COMMISSION_DECISION_REJECT
	decisionReturn  = enum.PurchaseCommissionDecision_PURCHASE_COMMISSION_DECISION_RETURN
)

var planTypeLabel = map[enum.PurchasePlanType]string{
	enum.PurchasePlanType_PURCHASE_PLAN_TYPE_PLANNED:   "плановая",
	enum.PurchasePlanType_PURCHASE_PLAN_TYPE_UNPLANNED: "внеплановая",
}

func validPlanYear(y int32) bool { return y >= 2000 && y <= 2100 }

type protocolInput struct {
	number, chairman, secretary, comment, fileName string
	heldAt                                         time.Time
	content                                        []byte
}

func (in *protocolInput) validate() error {
	in.number, in.comment = strings.TrimSpace(in.number), strings.TrimSpace(in.comment)
	in.chairman, in.secretary = strings.TrimSpace(in.chairman), strings.TrimSpace(in.secretary)
	switch {
	case in.number == "" || tooLong(in.number, 64):
		return invalid("укажите номер протокола (до 64 символов)")
	case in.heldAt.IsZero():
		return invalid("укажите дату заседания")
	case tooLong(in.chairman, 255) || tooLong(in.secretary, 255):
		return invalid("ФИО председателя или секретаря длиннее 255 символов")
	case tooLong(in.comment, 4096):
		return invalid("комментарий длиннее 4096 символов")
	case len(in.content) > maxFileSize:
		return invalid("файл больше 20 МБ")
	}
	in.fileName = fileName(in.fileName, "Протокол "+in.number)
	return nil
}

// decide applies one decision to a purchase. A purchase is decided while at
// the commission; a decision is revised while it is rejected, or approved
// with the ТЗ not started.
func decide(l *Lot, d *pb.PurchaseProtocolDecisionInput, a actor, now time.Time) (string, error) {
	comment := cut(strings.TrimSpace(d.GetComment()), 2048)
	switch d.GetDecision() {
	case decisionApprove:
		if l.Status != lotCommission && l.Status != lotRejected {
			return "", wrongState("закупка №%d %s — включить её нельзя", l.ID, lotStatusLabel[l.Status])
		}
		if planTypeLabel[d.GetPlanType()] == "" || !validPlanYear(d.GetPlanYear()) {
			return "", invalid("закупка №%d: укажите вид (плановая/внеплановая) и год ПФХД", l.ID)
		}
		l.Status, l.PlanType, l.PlanYear, l.StageSince = lotApproved, d.GetPlanType(), d.GetPlanYear(), &now
		l.SignOffs = signOff(l.SignOffs, a.signOff(roleCommission, int32(lotCommission), comment, now))
		l.LastComment = ""
		return fmt.Sprintf("Включила закупку в ПФХД %d как %s", l.PlanYear, planTypeLabel[l.PlanType]), nil
	case decisionReject:
		if l.Status != lotCommission && l.Status != lotApproved {
			return "", wrongState("закупка №%d %s — отклонить её нельзя", l.ID, lotStatusLabel[l.Status])
		}
		if comment == "" {
			return "", invalid("закупка №%d: укажите причину отклонения", l.ID)
		}
		l.Status, l.LastComment, l.StageSince = lotRejected, comment, &now
		l.SignOffs = dropFrom(l.SignOffs, lotRoute, order(lotRoute, lotCommission))
		return "Отклонила закупку", nil
	case decisionReturn:
		if l.Status != lotCommission {
			return "", wrongState("закупка №%d %s — вернуть её нельзя", l.ID, lotStatusLabel[l.Status])
		}
		if comment == "" {
			return "", invalid("закупка №%d: укажите, почему возвращаете", l.ID)
		}
		l.Status, l.LastComment, l.StageSince = lotEconomistReview, comment, &now
		l.SignOffs = dropFrom(l.SignOffs, lotRoute, order(lotRoute, lotEconomistReview))
		return "Вернула закупку в экономический отдел", nil
	}
	return "", invalid("закупка №%d: выберите решение", l.ID)
}

// ProtocolCreate records a meeting and applies its decisions together.
func (s *Service) ProtocolCreate(ctx context.Context, in protocolInput, decisions []*pb.PurchaseProtocolDecisionInput) (int64, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return 0, err
	}
	if !a.can(permCommission) {
		return 0, needPerm(permCommission)
	}
	if err := in.validate(); err != nil {
		return 0, err
	}
	if len(decisions) == 0 {
		return 0, invalid("в протоколе нет решений")
	}
	seen := map[int64]bool{}
	for _, d := range decisions {
		if seen[d.GetLotId()] {
			return 0, invalid("закупка №%d указана дважды", d.GetLotId())
		}
		seen[d.GetLotId()] = true
	}
	var p *Protocol
	err = s.store.tx(ctx, func(tx *storage) error {
		now := s.now()
		p = &Protocol{
			Number: in.number, HeldAt: in.heldAt, Chairman: in.chairman, Secretary: in.secretary,
			Comment: in.comment, Decisions: []Decision{}, CreatedBy: a.name, CreatedAt: now,
		}
		if len(in.content) > 0 {
			p.FileName, p.FileSize, p.FileContent = in.fileName, int64(len(in.content)), in.content
		}
		if err := tx.createProtocol(ctx, p); err != nil {
			return err
		}
		var logs []*Log
		for _, d := range decisions {
			l, err := tx.lotLocked(ctx, d.GetLotId())
			if err != nil {
				return err
			}
			text, err := decide(l, d, a, now)
			if err != nil {
				return err
			}
			l.ProtocolID, l.CommissionComment, l.UpdatedAt = &p.ID, cut(strings.TrimSpace(d.GetComment()), 2048), now
			if err := tx.saveLot(ctx, l); err != nil {
				return err
			}
			p.Decisions = append(p.Decisions, Decision{
				LotID: l.ID, LotTitle: l.Title, CuratorID: l.CuratorID, Amount: l.Amount(),
				Decision: d.GetDecision(), PlanType: l.PlanType, PlanYear: l.PlanYear, Comment: l.CommissionComment,
			})
			if d.GetDecision() != decisionApprove {
				p.Decisions[len(p.Decisions)-1].PlanType, p.Decisions[len(p.Decisions)-1].PlanYear = 0, 0
			}
			logs = append(logs, a.logAs(roleCommission, logLot, l.ID, "commission",
				fmt.Sprintf("%s (протокол № %s от %s)", text, p.Number, p.HeldAt.Format("02.01.2006")), l.CommissionComment, now))
		}
		slices.SortFunc(p.Decisions, func(x, y Decision) int { return int(x.LotID - y.LotID) })
		if err := tx.saveProtocol(ctx, p, len(in.content) > 0); err != nil {
			return err
		}
		logs = append(logs, a.logAs(roleCommission, logProtocol, p.ID, "create",
			fmt.Sprintf("Оформила протокол № %s: решений — %d", p.Number, len(p.Decisions)), "", now))
		return tx.addLogs(ctx, logs...)
	})
	if err != nil {
		return 0, err
	}
	return p.ID, nil
}

// ProtocolUpdate changes the protocol's details and file; decisions stay.
func (s *Service) ProtocolUpdate(ctx context.Context, id int64, in protocolInput) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	if !a.can(permCommission) {
		return needPerm(permCommission)
	}
	if err := in.validate(); err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		p, err := tx.protocol(ctx, id, false)
		if err != nil {
			return err
		}
		p.Number, p.HeldAt, p.Chairman, p.Secretary, p.Comment = in.number, in.heldAt, in.chairman, in.secretary, in.comment
		withFile := len(in.content) > 0
		if withFile {
			p.FileName, p.FileSize, p.FileContent = in.fileName, int64(len(in.content)), in.content
		}
		if err := tx.saveProtocol(ctx, p, withFile); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(roleCommission, logProtocol, p.ID, "update",
			fmt.Sprintf("Изменила протокол № %s", p.Number), "", s.now()))
	})
}

func (s *Service) ProtocolFile(ctx context.Context, id int64) (*Protocol, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	departments, err := s.store.departments(ctx)
	if err != nil {
		return nil, err
	}
	if !a.viewer(departments).plan {
		return nil, needPerm(permViewPlan)
	}
	p, err := s.store.protocol(ctx, id, true)
	if err != nil {
		return nil, err
	}
	if p.FileSize == 0 {
		return nil, notFound("файл протокола не загружен")
	}
	return p, nil
}
