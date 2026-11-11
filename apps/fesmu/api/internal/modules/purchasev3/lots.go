package purchasev3

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"dvgmu/api/internal/modules/purchase"
	enum "fesmu/contract/fesmu/enum/v3"
	pb "fesmu/contract/fesmu/service/v3"
)

// LotCreate: the implementing head merges requests sent to their department
// into a purchase.
func (s *Service) LotCreate(ctx context.Context, ids []int64, title, description string, curatorPick int64) (int64, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return 0, err
	}
	ids = uniqueIDs(ids)
	title, description = strings.TrimSpace(title), strings.TrimSpace(description)
	switch {
	case len(ids) == 0:
		return 0, invalid("выберите заявки для закупки")
	case tooLong(title, 255):
		return 0, invalid("наименование длиннее 255 символов")
	case tooLong(description, 4096):
		return 0, invalid("описание длиннее 4096 символов")
	}
	var l *Lot
	err = s.store.tx(ctx, func(tx *storage) error {
		list, err := tx.requestsLocked(ctx, ids)
		if err != nil {
			return err
		}
		if err := takeRequests(a, ids, list, reqImplementer); err != nil {
			return err
		}
		implementing := list[0].ImplementingDepartment
		for _, r := range list[1:] {
			if r.ImplementingDepartment != implementing {
				return invalid("в одну закупку объединяются заявки одного реализующего отдела")
			}
		}
		curatorID, err := directionOf(ctx, tx, a, implementing, curatorPick)
		if err != nil {
			return err
		}
		if title == "" {
			title = list[0].Title
		}
		quantity, unit := sumQuantity(list)
		now := s.now()
		l = &Lot{
			Title: title, Description: description, ItemType: list[0].ItemType, Quantity: quantity, Unit: unit,
			ImplementingDepartment: implementing, CuratorID: curatorID, Status: lotForming, StageSince: &now,
			InventoryNumbers: []string{}, SignOffs: []SignOff{}, CreatedBy: a.name,
			CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.createLot(ctx, l); err != nil {
			return err
		}
		logs := []*Log{a.logAs(roleImplementerHead, logLot, l.ID, "create",
			fmt.Sprintf("Сформировал закупку из заявок %s: %s — %s %s", idList(list), title, qty(quantity), unit), "", now)}
		for _, r := range list {
			joinLot(r, l, a, now)
			if err := tx.saveRequest(ctx, r); err != nil {
				return err
			}
			logs = append(logs, a.logAs(roleImplementerHead, logRequest, r.ID, "to_lot",
				fmt.Sprintf("Включил заявку в закупку №%d «%s»", l.ID, l.Title), "", now))
		}
		return tx.addLogs(ctx, logs...)
	})
	if err != nil {
		return 0, err
	}
	return l.ID, nil
}

func joinLot(r *Request, l *Lot, a actor, now time.Time) {
	r.SignOffs = signOff(r.SignOffs, a.signOff(roleImplementerHead, int32(reqImplementer), "", now))
	r.Status, r.LotID, r.LastComment, r.UpdatedAt, r.StageSince = reqInPurchase, &l.ID, "", now, &now
}

func leaveLot(r *Request, now time.Time) {
	r.SignOffs = dropFrom(r.SignOffs, requestRoute, order(requestRoute, reqImplementer))
	r.Status, r.LotID, r.UpdatedAt, r.StageSince = reqImplementer, nil, now, &now
}

// LotRequests adds requests to a forming purchase or takes them out.
func (s *Service) LotRequests(ctx context.Context, lotID int64, addIDs, removeIDs []int64) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	addIDs, removeIDs = uniqueIDs(addIDs), uniqueIDs(removeIDs)
	if len(addIDs) == 0 && len(removeIDs) == 0 {
		return nil
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, lotID)
		if err != nil {
			return err
		}
		if l.Status != lotForming {
			return wrongState("состав меняют, пока закупка формируется; сейчас она %s", lotStatusLabel[l.Status])
		}
		if _, err := a.actingOnLot(l); err != nil {
			return err
		}
		now := s.now()
		var logs []*Log
		if len(addIDs) > 0 {
			list, err := tx.requestsLocked(ctx, addIDs)
			if err != nil {
				return err
			}
			if err := takeRequests(a, addIDs, list, reqImplementer); err != nil {
				return err
			}
			for _, r := range list {
				if r.ImplementingDepartment != l.ImplementingDepartment || r.ItemType != l.ItemType {
					return invalid("заявка №%d другого реализующего отдела или типа", r.ID)
				}
				joinLot(r, l, a, now)
				if err := tx.saveRequest(ctx, r); err != nil {
					return err
				}
				logs = append(logs, a.logAs(roleImplementerHead, logRequest, r.ID, "to_lot",
					fmt.Sprintf("Включил заявку в закупку №%d «%s»", l.ID, l.Title), "", now))
			}
			logs = append(logs, a.logAs(roleImplementerHead, logLot, l.ID, "requests_add", "Добавил заявки "+idList(list), "", now))
		}
		inLot, err := tx.lotRequests(ctx, l.ID)
		if err != nil {
			return err
		}
		var removed []*Request
		for _, r := range inLot {
			if slices.Contains(removeIDs, r.ID) {
				removed = append(removed, r)
			}
		}
		if len(removed) == len(inLot) {
			return invalid("в закупке должна остаться хотя бы одна заявка — или расформируйте её")
		}
		for _, r := range removed {
			leaveLot(r, now)
			if err := tx.saveRequest(ctx, r); err != nil {
				return err
			}
			logs = append(logs, a.logAs(roleImplementerHead, logRequest, r.ID, "from_lot",
				fmt.Sprintf("Исключил заявку из закупки №%d", l.ID), "", now))
		}
		if len(removed) > 0 {
			logs = append(logs, a.logAs(roleImplementerHead, logLot, l.ID, "requests_remove", "Исключил заявки "+idList(removed), "", now))
		}
		if inLot, err = tx.lotRequests(ctx, l.ID); err != nil {
			return err
		}
		l.Quantity, l.Unit = sumQuantity(inLot)
		l.Nmck, l.UpdatedAt = 0, now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, logs...)
	})
}

// LotDisband deletes a forming purchase; its requests go back to the
// implementing department.
func (s *Service) LotDisband(ctx context.Context, id int64, comment string) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	comment = strings.TrimSpace(comment)
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, id)
		if err != nil {
			return err
		}
		if l.Status != lotForming {
			return wrongState("расформировать можно, пока закупка формируется; сейчас она %s", lotStatusLabel[l.Status])
		}
		if _, err := a.actingOnLot(l); err != nil {
			return err
		}
		list, err := tx.lotRequests(ctx, l.ID)
		if err != nil {
			return err
		}
		now := s.now()
		var logs []*Log
		for _, r := range list {
			leaveLot(r, now)
			if err := tx.saveRequest(ctx, r); err != nil {
				return err
			}
			logs = append(logs, a.logAs(roleImplementerHead, logRequest, r.ID, "disband",
				fmt.Sprintf("Расформировал закупку №%d «%s», заявка снова ждёт объединения", l.ID, l.Title), comment, now))
		}
		if err := tx.deleteLot(ctx, l.ID); err != nil {
			return err
		}
		return tx.addLogs(ctx, logs...)
	})
}

// LotMove moves a purchase along the route from its stage.
func (s *Service) LotMove(ctx context.Context, id int64, move enum.PurchaseMove, comment, assigneeUUID string) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	comment, assigneeUUID = strings.TrimSpace(comment), strings.TrimSpace(assigneeUUID)
	if tooLong(comment, 2048) {
		return invalid("комментарий длиннее 2048 символов")
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, id)
		if err != nil {
			return err
		}
		st, err := a.actingOnLot(l)
		if err != nil {
			return err
		}
		now := s.now()
		var text string
		switch move {
		case moveForward:
			next := nextLot(l, st)
			if next == 0 {
				return wrongState("решение по закупке принимается протоколом бюджетной комиссии")
			}
			if (l.Status == lotForming || l.Status == lotApproved) && assigneeUUID != "" && assigneeUUID != l.AssigneeUUID {
				name, err := s.employeeName(ctx, assigneeUUID, l.ImplementingDepartment)
				if err != nil {
					return err
				}
				l.AssigneeUUID, l.AssigneeName = assigneeUUID, cut(name, 255)
			}
			if err := lotReady(l); err != nil {
				return err
			}
			switch l.Status {
			case lotEconomistReview:
				// Without the economist's own figure the average-based one is approved.
				if l.Nmck == 0 {
					l.Nmck = l.Amount()
				}
			case lotForming, lotApproved:
				st.forward += ": " + l.AssigneeName
			}
			l.SignOffs = signOff(l.SignOffs, a.signOff(st.role, int32(st.status), comment, now))
			l.Status, l.LastComment, l.StageSince = next, "", &now
			switch next {
			case lotSpecCheck:
				fillCodes(l)
			case lotCompleted:
				l.CompletedAt = &now
			}
			text = st.forward
		case moveReturn:
			if st.prev == 0 {
				return wrongState("отсюда закупку не возвращают")
			}
			if comment == "" {
				return invalid("укажите комментарий — почему возвращаете")
			}
			l.SignOffs = dropFrom(l.SignOffs, lotRoute, order(lotRoute, st.prev))
			l.Status, l.LastComment, l.StageSince = st.prev, comment, &now
			text = "Вернул закупку: " + lotStatusLabel[l.Status]
		case moveReject:
			return wrongState("отклоняет закупку бюджетная комиссия — протоколом")
		default:
			return invalid("выберите действие")
		}
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logLot, l.ID, moveKey(move), text, comment, now))
	})
}

// LotStatusSet is an administrative override, separate from the regulated route.
func (s *Service) LotStatusSet(ctx context.Context, req *pb.PurchaseLotStatusSetRequest) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	if !a.can(permLotFullEdit) {
		return needPerm(permLotFullEdit)
	}
	status, comment := req.GetStatus(), strings.TrimSpace(req.GetComment())
	if status == enum.PurchaseLotStatus_PURCHASE_LOT_STATUS_UNSPECIFIED {
		return invalid("выберите статус закупки")
	}
	if _, ok := lotStatusLabel[status]; !ok {
		return invalid("неизвестный статус закупки")
	}
	comment = strings.TrimSpace(comment)
	if tooLong(comment, 2048) {
		return invalid("комментарий длиннее 2048 символов")
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, req.GetId())
		if err != nil {
			return err
		}
		previous := lotStatusLabel[l.Status]
		var changes change
		changes.text("статус", previous, lotStatusLabel[status])
		changes.text("тип плана", planTypeLabel[l.PlanType], planTypeLabel[req.GetPlanType()])
		changes.text("год ПФХД", strconv.Itoa(int(l.PlanYear)), strconv.Itoa(int(req.GetPlanYear())))
		changes.text("направление проректора", strconv.FormatInt(l.CuratorID, 10), strconv.FormatInt(req.GetCuratorId(), 10))
		changes.text("реализующий отдел", strconv.Itoa(int(l.ImplementingDepartment)), strconv.Itoa(int(req.GetImplementingDepartment())))
		changes.text("исполнитель", l.AssigneeName, req.GetAssigneeUuid())
		changes.text("комментарий комиссии", l.CommissionComment, req.GetCommissionComment())
		changes.text("тип объекта", itemTypeLabel[l.ItemType], itemTypeLabel[req.GetItemType()])
		now := s.now()
		statusChanged := l.Status != status
		l.Status, l.UpdatedAt = status, now
		if statusChanged {
			l.LastComment, l.StageSince = comment, &now
		} else if comment != "" {
			l.LastComment = comment
		}
		l.PlanType, l.PlanYear = req.GetPlanType(), req.GetPlanYear()
		l.CommissionComment = cut(strings.TrimSpace(req.GetCommissionComment()), 2048)
		if itemTypeLabel[req.GetItemType()] == "" {
			return invalid("выберите тип: товар или услуга")
		}
		l.ItemType = req.GetItemType()
		if l.PlanYear < 0 || l.PlanYear > 0 && !validPlanYear(l.PlanYear) {
			return invalid("год ПФХД должен быть от 2000 до 2100")
		}
		if l.PlanYear > 0 && planTypeLabel[l.PlanType] == "" {
			return invalid("выберите плановый или внеплановый вид ПФХД")
		}
		if l.PlanYear == 0 {
			l.PlanType = enum.PurchasePlanType_PURCHASE_PLAN_TYPE_UNSPECIFIED
		}
		implementing := req.GetImplementingDepartment()
		if implementing == 0 {
			implementing = l.ImplementingDepartment
		}
		if _, err := tx.department(ctx, implementing); err != nil {
			return err
		}
		l.ImplementingDepartment = implementing
		curator := req.GetCuratorId()
		if curator == 0 {
			curator = l.CuratorID
		}
		if _, err := tx.curator(ctx, curator); err != nil {
			return err
		}
		l.CuratorID = curator
		if req.GetAssigneeUuid() != "" {
			name, err := s.employeeName(ctx, req.GetAssigneeUuid(), implementing)
			if err != nil {
				return err
			}
			l.AssigneeUUID, l.AssigneeName = req.GetAssigneeUuid(), cut(name, 255)
		} else {
			l.AssigneeUUID, l.AssigneeName = "", ""
		}
		if statusChanged {
			if status == lotCompleted {
				l.CompletedAt = &now
			} else {
				l.CompletedAt = nil
			}
		}
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(roleImplementerHead, logLot, l.ID, "status_set",
			"Полное редактирование закупки: "+changes.String(), comment, now))
	})
}

// fillCodes puts the classifier's codes into a purchase that has none: the
// implementing head sees them at the check, the economist confirms them.
func fillCodes(l *Lot) {
	if l.Okpd2 != "" {
		return
	}
	if okpd2, _ := purchase.Classify(l.Title); okpd2 != "" {
		l.Okpd2, l.Ktru, l.Okved, l.CodesAuto = okpd2, okpd2, purchase.OkvedOf(okpd2), true
	}
}

// ── Each stage's fields ─────────────────────────────────────────────────

var (
	stageOne = []enum.PurchaseLotStatus{lotForming, lotSpecification, lotSpecCheck}
	stageTwo = []enum.PurchaseLotStatus{lotApproved, lotTechSpec, lotTechSpecCheck}
	inExec   = []enum.PurchaseLotStatus{lotProcurement, lotTendering, lotContracting, lotDelivery}
	innRe    = regexp.MustCompile(`^(\d{10}|\d{12})$`)
)

func timeOf(t *timestamppb.Timestamp) *time.Time {
	if t == nil {
		return nil
	}
	v := t.AsTime()
	return &v
}

func checkInn(inn string) error {
	if inn != "" && !innRe.MatchString(inn) {
		return invalid("ИНН — 10 или 12 цифр")
	}
	return nil
}

// LotUpdate saves the fields of the purchase's current stage.
func (s *Service) LotUpdate(ctx context.Context, req *pb.PurchaseLotUpdateRequest) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, req.GetId())
		if err != nil {
			return err
		}
		if p, ok := req.GetPatch().(*pb.PurchaseLotUpdateRequest_Deadline); ok {
			return s.lotDeadline(ctx, tx, a, l, p.Deadline)
		}
		if p, ok := req.GetPatch().(*pb.PurchaseLotUpdateRequest_Review); ok {
			return s.lotReview(ctx, tx, a, l, p.Review)
		}
		st, err := a.actingOnLot(l)
		if err != nil {
			return err
		}
		var c change
		var stages []enum.PurchaseLotStatus
		switch p := req.GetPatch().(type) {
		case *pb.PurchaseLotUpdateRequest_Content:
			stages = append(slices.Clone(stageOne), stageTwo...)
			if a.can(permLotFullEdit) {
				status := l.Status
				l.Status = lotSpecCheck
				err = patchContent(l, p.Content, &c)
				l.Status = status
				tech := strings.TrimSpace(p.Content.GetTechSpec())
				if tooLong(tech, 100000) {
					return invalid("ТЗ слишком длинное")
				}
				c.text("ТЗ", l.TechSpec, tech)
				l.TechSpec = tech
			} else {
				err = patchContent(l, p.Content, &c)
			}
		case *pb.PurchaseLotUpdateRequest_Curator:
			stages = []enum.PurchaseLotStatus{lotCuratorReview}
			v := strings.TrimSpace(p.Curator.GetCuratorJustification())
			if tooLong(v, 4096) {
				return invalid("обоснование длиннее 4096 символов")
			}
			c.text("обоснование для комиссии", l.CuratorJustification, v)
			l.CuratorJustification = v
		case *pb.PurchaseLotUpdateRequest_Budget:
			stages = []enum.PurchaseLotStatus{lotEconomistReview}
			err = patchBudget(l, p.Budget, &c)
		case *pb.PurchaseLotUpdateRequest_FinalCost:
			stages = []enum.PurchaseLotStatus{lotFinalCost}
			v, comment := p.FinalCost.GetFinalCost(), strings.TrimSpace(p.FinalCost.GetFinalCostComment())
			if v < 0 || tooLong(comment, 2048) {
				return invalid("неверная конечная стоимость")
			}
			c.text("конечная стоимость", rub(l.FinalCost), rub(v))
			c.text("обоснование стоимости", l.FinalCostComment, comment)
			l.FinalCost, l.FinalCostComment = v, comment
		case *pb.PurchaseLotUpdateRequest_Law:
			stages = []enum.PurchaseLotStatus{lotContractService}
			err = patchLaw(l, p.Law, &c)
		case *pb.PurchaseLotUpdateRequest_Execution:
			stages = inExec
			err = patchExecution(l, p.Execution, &c)
		case *pb.PurchaseLotUpdateRequest_Acceptance:
			stages = []enum.PurchaseLotStatus{lotAcceptance}
			comment := strings.TrimSpace(p.Acceptance.GetAcceptanceComment())
			if tooLong(comment, 2048) {
				return invalid("комментарий длиннее 2048 символов")
			}
			at := timeOf(p.Acceptance.GetAcceptedAt())
			c.text("дата приёмки", day(l.AcceptedAt), day(at))
			c.text("комментарий приёмки", l.AcceptanceComment, comment)
			l.AcceptedAt, l.AcceptanceComment = at, comment
		case *pb.PurchaseLotUpdateRequest_Inventory:
			stages = []enum.PurchaseLotStatus{lotInventory}
			err = patchInventory(l, p.Inventory.GetInventoryNumbers(), &c)
		default:
			return invalid("нечего сохранять")
		}
		if !a.can(permLotFullEdit) && !slices.Contains(stages, l.Status) {
			return wrongState("закупка %s — эти поля сейчас не меняют", lotStatusLabel[l.Status])
		}
		if err != nil || len(c) == 0 {
			return err
		}
		now := s.now()
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logLot, l.ID, "update", "Изменил закупку: "+c.String(), "", now))
	})
}

// lotDeadline sets the purchase's control date: the implementing head may
// at any stage, whoever acts at the current stage may too.
func (s *Service) lotDeadline(ctx context.Context, tx *storage, a actor, l *Lot, p *pb.PurchaseLotDeadlinePatch) error {
	role, err := a.overseer(l)
	if err != nil {
		return err
	}
	if l.Status == lotCompleted && !a.can(permLotFullEdit) {
		return wrongState("закупка завершена — срок не меняют")
	}
	comment := strings.TrimSpace(p.GetDueComment())
	if tooLong(comment, 1024) {
		return invalid("пояснение длиннее 1024 символов")
	}
	due := timeOf(p.GetDueAt())
	var c change
	c.text("контрольный срок", day(l.DueAt), day(due))
	c.text("пояснение к сроку", l.DueComment, comment)
	if len(c) == 0 {
		return nil
	}
	now := s.now()
	l.DueAt, l.DueComment, l.UpdatedAt = due, comment, now
	if err := tx.saveLot(ctx, l); err != nil {
		return err
	}
	return tx.addLogs(ctx, a.logAs(role, logLot, l.ID, "deadline", "Изменил срок: "+c.String(), "", now))
}

// overseer: the implementing head may adjust a purchase at any stage, whoever
// acts at the current stage may too; the role is for the log.
func (a actor) overseer(l *Lot) (enum.PurchaseRole, error) {
	if a.can(permLotManage) && a.inDepartment(l.ImplementingDepartment) {
		return roleImplementerHead, nil
	}
	st, err := a.actingOnLot(l)
	return st.role, err
}

// lotReview replaces the remarks left by a transfer: empty — checked.
func (s *Service) lotReview(ctx context.Context, tx *storage, a actor, l *Lot, p *pb.PurchaseLotReviewPatch) error {
	role, err := a.overseer(l)
	if err != nil {
		return err
	}
	note := strings.TrimSpace(p.GetReviewNote())
	if tooLong(note, 20000) {
		return invalid("замечания длиннее 20000 символов")
	}
	if note == l.ReviewNote {
		return nil
	}
	now := s.now()
	text := "Отметил замечания после переноса как проверенные"
	if note != "" {
		text = "Изменил замечания для проверки"
	}
	l.ReviewNote, l.UpdatedAt = note, now
	if err := tx.saveLot(ctx, l); err != nil {
		return err
	}
	return tx.addLogs(ctx, a.logAs(role, logLot, l.ID, "review", text, "", now))
}

// patchContent: before the commission — the object, its characteristics and
// codes; after it — only the description and the ТЗ (what was approved stays).
func patchContent(l *Lot, p *pb.PurchaseLotContentPatch, c *change) error {
	description, techSpec := strings.TrimSpace(p.GetDescription()), strings.TrimSpace(p.GetTechSpec())
	if tooLong(description, 4096) || tooLong(techSpec, 100000) {
		return invalid("описание или ТЗ слишком длинные")
	}
	c.text("описание", l.Description, description)
	l.Description = description
	if slices.Contains(stageTwo, l.Status) {
		if techSpec != l.TechSpec {
			*c = append(*c, "ТЗ")
		}
		l.TechSpec = techSpec
		return nil
	}
	title, unit, spec := strings.TrimSpace(p.GetTitle()), strings.TrimSpace(p.GetUnit()), strings.TrimSpace(p.GetSpecification())
	okpd2, ktru, okved := strings.TrimSpace(p.GetOkpd2()), strings.TrimSpace(p.GetKtru()), strings.TrimSpace(p.GetOkved())
	switch {
	case title == "" || tooLong(title, 255):
		return invalid("укажите наименование (до 255 символов)")
	case !(p.GetQuantity() > 0) || p.GetQuantity() > maxQuantity:
		return invalid("количество должно быть больше нуля")
	case tooLong(unit, 32) || tooLong(spec, 100000):
		return invalid("единица измерения или характеристики слишком длинные")
	case tooLong(okpd2, 32) || tooLong(ktru, 64) || tooLong(okved, 32):
		return invalid("коды слишком длинные")
	}
	if unit == "" {
		unit = l.Unit
	}
	c.text("наименование", l.Title, title)
	c.text("количество", qty(l.Quantity)+" "+l.Unit, qty(p.GetQuantity())+" "+unit)
	if spec != l.Specification {
		*c = append(*c, "характеристики")
	}
	codes := change{}
	codes.text("ОКПД2", l.Okpd2, okpd2)
	codes.text("КТРУ", l.Ktru, ktru)
	codes.text("ОКВЭД2", l.Okved, okved)
	*c = append(*c, codes...)
	if len(codes) > 0 {
		l.CodesAuto = false
	}
	// A new quantity needs НМЦК approved again (п. 5.5).
	if p.GetQuantity() != l.Quantity {
		l.Nmck = 0
	}
	l.Title, l.Quantity, l.Unit, l.Specification = title, p.GetQuantity(), unit, spec
	l.Okpd2, l.Ktru, l.Okved = okpd2, ktru, okved
	return nil
}

var fundingLabel = map[enum.PurchaseFundingSource]string{
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_UNSPECIFIED:    "не указан",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_STATE_TASK:     "субсидия на госзадание",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_TARGET_SUBSIDY: "целевая субсидия",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_INCOME:         "приносящая доход деятельность",
	enum.PurchaseFundingSource_PURCHASE_FUNDING_SOURCE_OMS:            "средства ОМС",
}

func patchBudget(l *Lot, p *pb.PurchaseLotBudgetPatch, c *change) error {
	okpd2, ktru, okved := strings.TrimSpace(p.GetOkpd2()), strings.TrimSpace(p.GetKtru()), strings.TrimSpace(p.GetOkved())
	kosgu, comment := strings.TrimSpace(p.GetKosgu()), strings.TrimSpace(p.GetEconomistComment())
	switch {
	case tooLong(okpd2, 32) || tooLong(ktru, 64) || tooLong(okved, 32) || tooLong(kosgu, 32):
		return invalid("коды слишком длинные")
	case fundingLabel[p.GetFundingSource()] == "":
		return invalid("неизвестный источник финансирования")
	case p.GetNmck() < 0:
		return invalid("НМЦК не может быть отрицательной")
	case tooLong(comment, 2048):
		return invalid("заключение длиннее 2048 символов")
	}
	c.text("ОКПД2", l.Okpd2, okpd2)
	c.text("КТРУ", l.Ktru, ktru)
	c.text("ОКВЭД2", l.Okved, okved)
	c.text("источник финансирования", fundingLabel[l.FundingSource], fundingLabel[p.GetFundingSource()])
	c.text("КОСГУ", l.Kosgu, kosgu)
	c.text("НМЦК", rub(l.Nmck), rub(p.GetNmck()))
	c.text("заключение", l.EconomistComment, comment)
	l.Okpd2, l.Ktru, l.Okved, l.CodesAuto = okpd2, ktru, okved, false
	l.FundingSource, l.Kosgu, l.Nmck, l.EconomistComment = p.GetFundingSource(), kosgu, p.GetNmck(), comment
	return nil
}

var lawLabel = map[enum.PurchaseLaw]string{
	enum.PurchaseLaw_PURCHASE_LAW_UNSPECIFIED: "не выбран",
	enum.PurchaseLaw_PURCHASE_LAW_FZ44:        "44-ФЗ",
	enum.PurchaseLaw_PURCHASE_LAW_FZ223:       "223-ФЗ",
}

var methodLabel = map[enum.PurchaseMethod]string{
	enum.PurchaseMethod_PURCHASE_METHOD_UNSPECIFIED:        "не выбран",
	enum.PurchaseMethod_PURCHASE_METHOD_ELECTRONIC_AUCTION: "электронный аукцион",
	enum.PurchaseMethod_PURCHASE_METHOD_OPEN_TENDER:        "открытый конкурс",
	enum.PurchaseMethod_PURCHASE_METHOD_QUOTATION_REQUEST:  "запрос котировок",
	enum.PurchaseMethod_PURCHASE_METHOD_PROPOSAL_REQUEST:   "запрос предложений",
	enum.PurchaseMethod_PURCHASE_METHOD_SINGLE_SUPPLIER:    "у единственного поставщика",
	enum.PurchaseMethod_PURCHASE_METHOD_OTHER:              "иной способ",
}

func patchLaw(l *Lot, p *pb.PurchaseLotLawPatch, c *change) error {
	comment := strings.TrimSpace(p.GetContractServiceComment())
	switch {
	case lawLabel[p.GetLaw()] == "" || methodLabel[p.GetMethod()] == "":
		return invalid("неизвестный закон или способ закупки")
	case p.GetLaw() == enum.PurchaseLaw_PURCHASE_LAW_FZ44 &&
		(p.GetMethod() == enum.PurchaseMethod_PURCHASE_METHOD_PROPOSAL_REQUEST || p.GetMethod() == enum.PurchaseMethod_PURCHASE_METHOD_OTHER):
		return invalid("по 44-ФЗ такого способа нет")
	case tooLong(comment, 2048):
		return invalid("комментарий длиннее 2048 символов")
	}
	c.text("закон", lawLabel[l.Law], lawLabel[p.GetLaw()])
	c.text("способ", methodLabel[l.Method], methodLabel[p.GetMethod()])
	c.text("комментарий", l.ContractServiceComment, comment)
	l.Law, l.Method, l.ContractServiceComment = p.GetLaw(), p.GetMethod(), comment
	return nil
}

func patchExecution(l *Lot, p *pb.PurchaseLotExecutionPatch, c *change) error {
	notice, supplier := strings.TrimSpace(p.GetNoticeNumber()), strings.TrimSpace(p.GetSupplier())
	inn, number := strings.TrimSpace(p.GetSupplierInn()), strings.TrimSpace(p.GetContractNumber())
	switch {
	case tooLong(notice, 64) || tooLong(number, 64) || tooLong(supplier, 255):
		return invalid("номер или поставщик слишком длинные")
	case p.GetContractAmount() < 0:
		return invalid("сумма контракта не может быть отрицательной")
	}
	if err := checkInn(inn); err != nil {
		return err
	}
	noticeAt, contractAt := timeOf(p.GetNoticeAt()), timeOf(p.GetContractAt())
	due, delivered := timeOf(p.GetDeliveryDue()), timeOf(p.GetDeliveredAt())
	c.text("извещение", l.NoticeNumber+" "+day(l.NoticeAt), notice+" "+day(noticeAt))
	c.text("поставщик", l.Supplier+" "+l.SupplierInn, supplier+" "+inn)
	c.text("контракт", l.ContractNumber+" "+day(l.ContractAt), number+" "+day(contractAt))
	c.text("сумма контракта", rub(l.ContractAmount), rub(p.GetContractAmount()))
	c.text("срок исполнения", day(l.DeliveryDue), day(due))
	c.text("дата поставки", day(l.DeliveredAt), day(delivered))
	l.NoticeNumber, l.NoticeAt, l.Supplier, l.SupplierInn = notice, noticeAt, supplier, inn
	l.ContractNumber, l.ContractAt, l.ContractAmount = number, contractAt, p.GetContractAmount()
	l.DeliveryDue, l.DeliveredAt = due, delivered
	return nil
}

func patchInventory(l *Lot, numbers []string, c *change) error {
	var out []string
	for _, n := range numbers {
		n = strings.TrimSpace(n)
		if n == "" || slices.Contains(out, n) {
			continue
		}
		if tooLong(n, 64) {
			return invalid("инвентарный номер длиннее 64 символов")
		}
		out = append(out, n)
	}
	if len(out) > 1000 {
		return invalid("слишком много инвентарных номеров")
	}
	if out == nil {
		out = []string{}
	}
	c.text("инвентарные номера", strings.Join(l.InventoryNumbers, ", "), strings.Join(out, ", "))
	l.InventoryNumbers = out
	return nil
}
