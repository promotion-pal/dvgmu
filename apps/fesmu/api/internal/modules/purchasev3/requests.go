package purchasev3

import (
	"context"
	"fmt"
	"slices"
	"strings"

	enum "dvgmu/api/contract/gen/go/enum/v3"
)

type requestInput struct {
	title, unit, description string
	quantity                 float64
	itemType                 enum.PurchaseItemType
	// Which of the author's departments asks; 0 — the only one.
	department int32
}

func (in *requestInput) normalize() {
	in.title = strings.TrimSpace(in.title)
	in.description = strings.TrimSpace(in.description)
	if in.itemType == enum.PurchaseItemType_PURCHASE_ITEM_TYPE_UNSPECIFIED {
		in.itemType = itemProduct
	}
	in.unit = strings.TrimSpace(in.unit)
	if in.unit == "" {
		in.unit = defaultUnit
		if in.itemType == itemService {
			in.unit = serviceUnit
		}
	}
}

func (in requestInput) validate() error {
	switch {
	case in.title == "":
		return invalid("укажите наименование товара или услуги")
	case tooLong(in.title, 255):
		return invalid("наименование длиннее 255 символов")
	case itemTypeLabel[in.itemType] == "":
		return invalid("укажите, товар это или услуга")
	case !(in.quantity > 0) || in.quantity > maxQuantity:
		return invalid("количество должно быть больше нуля")
	case tooLong(in.unit, 32):
		return invalid("единица измерения длиннее 32 символов")
	case tooLong(in.description, 4096):
		return invalid("описание длиннее 4096 символов")
	}
	return nil
}

// authorDepartment is the department a request is filed for: the one asked
// for, if the author is in it, or the author's only one.
func (a actor) authorDepartment(asked int32) (int32, error) {
	switch {
	case asked != 0 && a.inDepartment(asked):
		return asked, nil
	case asked != 0:
		return 0, forbidden("вы не сотрудник этого отдела")
	case len(a.departments) == 1:
		return a.departments[0], nil
	case len(a.departments) > 1:
		return 0, invalid("вы в нескольких отделах — выберите, от какого заявка")
	case a.admin:
		// An administrator without a department files for any one, named.
		return 0, invalid("выберите отдел, от которого подаёте заявку")
	}
	return 0, invalid("в вашем профиле не указан отдел — обратитесь к администратору")
}

// RequestCreate files a request for the author's department: it goes to that
// department's head.
func (s *Service) RequestCreate(ctx context.Context, in requestInput) (int64, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return 0, err
	}
	if !a.can(permRequestCreate) {
		return 0, needPerm(permRequestCreate)
	}
	in.normalize()
	if err := in.validate(); err != nil {
		return 0, err
	}
	department, err := a.authorDepartment(in.department)
	if err != nil {
		return 0, err
	}
	if _, err := s.store.department(ctx, department); err != nil {
		return 0, err
	}
	now := s.now()
	r := &Request{
		Title: in.title, ItemType: in.itemType, Quantity: in.quantity, Unit: in.unit, Description: in.description,
		Department: department, AuthorUUID: a.uuid, AuthorName: a.name,
		Status: reqHeadReview, StageSince: &now, SignOffs: []SignOff{a.signOff(roleEmployee, int32(reqRework), "", now)},
		CreatedAt: now, UpdatedAt: now,
	}
	err = s.store.tx(ctx, func(tx *storage) error {
		if err := tx.createRequest(ctx, r); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(roleEmployee, logRequest, r.ID, "create",
			fmt.Sprintf("Подал заявку (%s): %s — %s %s", itemTypeLabel[r.ItemType], r.Title, qty(r.Quantity), r.Unit), "", now))
	})
	return r.ID, err
}

// RequestUpdate: the author edits a request in rework, the head one under review.
func (s *Service) RequestUpdate(ctx context.Context, id int64, in requestInput) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	in.normalize()
	if err := in.validate(); err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		r, err := tx.requestLocked(ctx, id)
		if err != nil {
			return err
		}
		st, _, ok := stageOf(requestRoute, r.Status)
		if !ok || (r.Status != reqRework && r.Status != reqHeadReview) {
			return wrongState("заявка %s — её уже не правят", requestStatusLabel[r.Status])
		}
		if err := a.mayRequest(st, r); err != nil {
			return err
		}
		var c change
		c.text("наименование", r.Title, in.title)
		c.text("тип", itemTypeLabel[r.ItemType], itemTypeLabel[in.itemType])
		c.text("количество", qty(r.Quantity)+" "+r.Unit, qty(in.quantity)+" "+in.unit)
		c.text("описание", r.Description, in.description)
		if len(c) == 0 {
			return nil
		}
		now := s.now()
		r.Title, r.ItemType, r.Quantity, r.Unit, r.Description = in.title, in.itemType, in.quantity, in.unit, in.description
		r.UpdatedAt = now
		if err := tx.saveRequest(ctx, r); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logRequest, r.ID, "update", "Изменил заявку: "+c.String(), "", now))
	})
}

// RequestDelete: the author takes back a request not yet past their department.
func (s *Service) RequestDelete(ctx context.Context, id int64) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		r, err := tx.requestLocked(ctx, id)
		if err != nil {
			return err
		}
		if !a.allowedRequest(r).GetRemove() {
			if r.Status != reqHeadReview && r.Status != reqRework {
				return wrongState("заявка %s — удалить её уже нельзя", requestStatusLabel[r.Status])
			}
			return forbidden("удалить заявку может только её автор")
		}
		return tx.deleteRequest(ctx, r.ID)
	})
}

// RequestMove moves a request along the route from its stage.
func (s *Service) RequestMove(ctx context.Context, id int64, move enum.PurchaseMove, comment string, implementing int32, curatorPick int64) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	comment = strings.TrimSpace(comment)
	if tooLong(comment, 2048) {
		return invalid("комментарий длиннее 2048 символов")
	}
	return s.store.tx(ctx, func(tx *storage) error {
		r, err := tx.requestLocked(ctx, id)
		if err != nil {
			return err
		}
		st, _, ok := stageOf(requestRoute, r.Status)
		if !ok {
			return wrongState("заявка %s — дальше её не двигают", requestStatusLabel[r.Status])
		}
		if err := a.mayRequest(st, r); err != nil {
			return err
		}
		now := s.now()
		var text string
		switch move {
		case moveForward:
			if st.next == 0 {
				return wrongState("заявку объединяют в закупку — выберите её и нажмите «Сформировать закупку»")
			}
			switch r.Status {
			case reqHeadReview:
				curatorID, err := directionOf(ctx, tx, a, r.Department, curatorPick)
				if err != nil {
					return err
				}
				r.CuratorID = &curatorID
			case reqCurator:
				if implementing == 0 {
					categories, err := tx.categories(ctx)
					if err != nil {
						return err
					}
					implementing = suggestDepartment(categories, r.Title)
				}
				if implementing == 0 {
					return invalid("выберите реализующий отдел — по наименованию он не определился")
				}
				if _, err := tx.department(ctx, implementing); err != nil {
					return err
				}
				r.ImplementingDepartment = implementing
			}
			r.SignOffs = signOff(r.SignOffs, a.signOff(st.role, int32(st.status), comment, now))
			r.Status, r.LastComment, r.StageSince = st.next, "", &now
			text = st.forward
			if r.Status == reqImplementer {
				text += ": " + departmentName(ctx, tx, implementing)
			}
		case moveReturn:
			if st.prev == 0 {
				return wrongState("отсюда заявку не возвращают")
			}
			if comment == "" {
				return invalid("укажите комментарий — почему возвращаете")
			}
			r.SignOffs = dropFrom(r.SignOffs, requestRoute, order(requestRoute, st.prev))
			r.Status, r.LastComment, r.StageSince = st.prev, comment, &now
			if r.Status == reqCurator {
				r.ImplementingDepartment = 0
			}
			text = "Вернул заявку: " + requestStatusLabel[r.Status]
		case moveReject:
			if !st.reject {
				return wrongState("на этом этапе заявку не отклоняют")
			}
			if comment == "" {
				return invalid("укажите комментарий — почему отклоняете")
			}
			r.Status, r.LastComment, r.StageSince = reqRejected, comment, &now
			text = "Отклонил заявку"
		default:
			return invalid("выберите действие")
		}
		r.UpdatedAt = now
		if err := tx.saveRequest(ctx, r); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logRequest, r.ID, moveKey(move), text, comment, now))
	})
}

func moveKey(m enum.PurchaseMove) string {
	return strings.ToLower(strings.TrimPrefix(m.String(), "PURCHASE_MOVE_"))
}

func uniqueIDs(ids []int64) []int64 {
	out := slices.Clone(ids)
	slices.Sort(out)
	return slices.Compact(out)
}

func idList(list []*Request) string {
	parts := make([]string, len(list))
	for i, r := range list {
		parts[i] = fmt.Sprintf("№%d", r.ID)
	}
	return strings.Join(parts, ", ")
}

// takeRequests checks found are all of ids, at status, of one type, and each
// is the user's to act on at that stage.
func takeRequests(a actor, ids []int64, found []*Request, status enum.PurchaseRequestStatus) error {
	if len(found) != len(ids) {
		return notFound("часть заявок не найдена")
	}
	st, _, _ := stageOf(requestRoute, status)
	for _, r := range found {
		if r.Status != status {
			return wrongState("заявка №%d %s", r.ID, requestStatusLabel[r.Status])
		}
		if r.ItemType != found[0].ItemType {
			return invalid("товары и услуги объединяются отдельно")
		}
		if err := a.mayRequest(st, r); err != nil {
			return fmt.Errorf("заявка №%d: %w", r.ID, err)
		}
	}
	return nil
}

func sumQuantity(list []*Request) (float64, string) {
	var q float64
	unit := ""
	for _, r := range list {
		q += r.Quantity
		if unit == "" {
			unit = r.Unit
		} else if unit != r.Unit {
			unit = defaultUnit
		}
	}
	return q, unit
}

// RequestMerge: the head merges requests of their department under review
// into a new one; the originals stay, marked merged.
func (s *Service) RequestMerge(ctx context.Context, ids []int64, title, description string) (int64, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return 0, err
	}
	ids = uniqueIDs(ids)
	title, description = strings.TrimSpace(title), strings.TrimSpace(description)
	switch {
	case len(ids) < 2:
		return 0, invalid("выберите хотя бы две заявки")
	case title == "" || tooLong(title, 255):
		return 0, invalid("укажите наименование объединённой заявки (до 255 символов)")
	case tooLong(description, 4096):
		return 0, invalid("описание длиннее 4096 символов")
	}
	var merged *Request
	err = s.store.tx(ctx, func(tx *storage) error {
		list, err := tx.requestsLocked(ctx, ids)
		if err != nil {
			return err
		}
		if err := takeRequests(a, ids, list, reqHeadReview); err != nil {
			return err
		}
		for _, r := range list[1:] {
			if r.Department != list[0].Department {
				return invalid("объединяются заявки одного отдела")
			}
		}
		now := s.now()
		quantity, unit := sumQuantity(list)
		if description == "" {
			var parts []string
			for _, r := range list {
				parts = append(parts, fmt.Sprintf("№%d %s (%s, %s %s)", r.ID, r.Title, r.AuthorName, qty(r.Quantity), r.Unit))
			}
			description = cut("Объединены: "+strings.Join(parts, "; "), 4096)
		}
		merged = &Request{
			Title: title, ItemType: list[0].ItemType, Quantity: quantity, Unit: unit, Description: description,
			Department: list[0].Department, AuthorUUID: a.uuid, AuthorName: a.name,
			Status: reqHeadReview, StageSince: &now, SignOffs: []SignOff{}, CreatedAt: now, UpdatedAt: now,
		}
		if err := tx.createRequest(ctx, merged); err != nil {
			return err
		}
		logs := []*Log{a.logAs(roleHead, logRequest, merged.ID, "merge",
			fmt.Sprintf("Объединил заявки %s: %s — %s %s", idList(list), title, qty(quantity), unit), "", now)}
		for _, r := range list {
			r.Status, r.MergedIntoID, r.UpdatedAt, r.StageSince = reqMerged, &merged.ID, now, &now
			if err := tx.saveRequest(ctx, r); err != nil {
				return err
			}
			logs = append(logs, a.logAs(roleHead, logRequest, r.ID, "merge",
				fmt.Sprintf("Объединил с другими в заявку №%d «%s»", merged.ID, title), "", now))
		}
		return tx.addLogs(ctx, logs...)
	})
	if err != nil {
		return 0, err
	}
	return merged.ID, nil
}
