package purchasev3

import (
	"context"
	"fmt"
	"strings"

	enum "dvgmu/api/contract/gen/go/enum/v3"
)

type quotationInput struct {
	supplier, inn, note, fileName string
	unitPrice                     int64
	content                       []byte
}

// Offers are attached while the characteristics are prepared and checked.
func mayEditOffers(a actor, l *Lot) (stage[enum.PurchaseLotStatus], error) {
	if l.Status != lotSpecification && l.Status != lotSpecCheck {
		return stage[enum.PurchaseLotStatus]{}, wrongState("КП прикрепляют, пока готовятся характеристики; закупка %s", lotStatusLabel[l.Status])
	}
	return a.actingOnLot(l)
}

func (s *Service) QuotationCreate(ctx context.Context, lotID int64, in quotationInput) (int64, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return 0, err
	}
	in.supplier, in.inn, in.note = strings.TrimSpace(in.supplier), strings.TrimSpace(in.inn), strings.TrimSpace(in.note)
	switch {
	case in.supplier == "" || tooLong(in.supplier, 255):
		return 0, invalid("укажите поставщика (до 255 символов)")
	case in.unitPrice <= 0:
		return 0, invalid("цена за единицу должна быть больше нуля")
	case tooLong(in.note, 1024):
		return 0, invalid("примечание длиннее 1024 символов")
	case len(in.content) > maxFileSize:
		return 0, invalid("файл больше 20 МБ")
	}
	if err := checkInn(in.inn); err != nil {
		return 0, err
	}
	in.fileName = fileName(in.fileName, "КП")
	if len(in.content) == 0 {
		in.fileName = ""
	}
	var q *Quotation
	err = s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, lotID)
		if err != nil {
			return err
		}
		st, err := mayEditOffers(a, l)
		if err != nil {
			return err
		}
		now := s.now()
		q = &Quotation{
			LotID: l.ID, Supplier: in.supplier, SupplierInn: in.inn, UnitPrice: in.unitPrice, Note: in.note,
			FileName: in.fileName, FileSize: int64(len(in.content)), FileContent: in.content,
			CreatedBy: a.name, CreatedAt: now,
		}
		if err := tx.createQuotation(ctx, q); err != nil {
			return err
		}
		// New offers need НМЦК approved again (п. 5.5).
		l.Nmck, l.UpdatedAt = 0, now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logLot, l.ID, "quotation_add",
			fmt.Sprintf("Прикрепил КП: %s — %s за ед.", q.Supplier, rub(q.UnitPrice)), q.Note, now))
	})
	if err != nil {
		return 0, err
	}
	return q.ID, nil
}

func (s *Service) QuotationDelete(ctx context.Context, id int64) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		q, err := tx.quotation(ctx, id, false)
		if err != nil {
			return err
		}
		l, err := tx.lotLocked(ctx, q.LotID)
		if err != nil {
			return err
		}
		st, err := mayEditOffers(a, l)
		if err != nil {
			return err
		}
		if err := tx.deleteQuotation(ctx, q.ID); err != nil {
			return err
		}
		now := s.now()
		l.Nmck, l.UpdatedAt = 0, now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logLot, l.ID, "quotation_delete",
			fmt.Sprintf("Удалил КП: %s — %s за ед.", q.Supplier, rub(q.UnitPrice)), "", now))
	})
}

var documentKindLabel = map[enum.PurchaseDocumentKind]string{
	enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_SPECIFICATION:  "характеристики",
	enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_TECH_SPEC:      "техническое задание",
	enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_NOTICE:         "извещение",
	enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_CONTRACT:       "контракт",
	enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_SHIPPING:       "накладная / УПД",
	enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_ACCEPTANCE_ACT: "акт приёмки",
	enum.PurchaseDocumentKind_PURCHASE_DOCUMENT_KIND_OTHER:          "документ",
}

// DocumentCreate: whoever acts at the purchase's stage attaches its files.
func (s *Service) DocumentCreate(ctx context.Context, lotID int64, kind enum.PurchaseDocumentKind, note, name string, content []byte) (int64, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return 0, err
	}
	note = strings.TrimSpace(note)
	switch {
	case documentKindLabel[kind] == "":
		return 0, invalid("выберите вид документа")
	case len(content) == 0:
		return 0, invalid("прикрепите файл")
	case len(content) > maxFileSize:
		return 0, invalid("файл больше 20 МБ")
	case tooLong(note, 1024):
		return 0, invalid("примечание длиннее 1024 символов")
	}
	var d *Document
	err = s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, lotID)
		if err != nil {
			return err
		}
		st, err := a.actingOnLot(l)
		if err != nil {
			return err
		}
		now := s.now()
		d = &Document{
			LotID: l.ID, Kind: kind, Note: note, FileName: fileName(name, documentKindLabel[kind]),
			FileSize: int64(len(content)), FileContent: content, CreatedBy: a.name, CreatedAt: now,
		}
		if err := tx.createDocument(ctx, d); err != nil {
			return err
		}
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logLot, l.ID, "document_add",
			fmt.Sprintf("Прикрепил %s: %s", documentKindLabel[kind], d.FileName), note, now))
	})
	if err != nil {
		return 0, err
	}
	return d.ID, nil
}

func (s *Service) DocumentDelete(ctx context.Context, id int64) error {
	a, err := s.begin(ctx)
	if err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		d, err := tx.document(ctx, id, false)
		if err != nil {
			return err
		}
		l, err := tx.lotLocked(ctx, d.LotID)
		if err != nil {
			return err
		}
		st, err := a.actingOnLot(l)
		if err != nil {
			return err
		}
		if err := tx.deleteDocument(ctx, d.ID); err != nil {
			return err
		}
		now := s.now()
		l.UpdatedAt = now
		if err := tx.saveLot(ctx, l); err != nil {
			return err
		}
		return tx.addLogs(ctx, a.logAs(st.role, logLot, l.ID, "document_delete",
			fmt.Sprintf("Удалил %s: %s", documentKindLabel[d.Kind], d.FileName), "", now))
	})
}

// seesLot: the user sees purchase id (files are given only from those).
func (s *Service) seesLot(ctx context.Context, a actor, id int64) error {
	departments, err := s.store.departments(ctx)
	if err != nil {
		return err
	}
	v := a.viewer(departments)
	if v.all {
		return nil
	}
	return s.store.tx(ctx, func(tx *storage) error {
		l, err := tx.lotLocked(ctx, id)
		if err != nil {
			return err
		}
		requests, err := tx.lotRequests(ctx, l.ID)
		if err != nil {
			return err
		}
		if !v.seesLot(l, requests) {
			return notFound("файл не найден")
		}
		return nil
	})
}

func (s *Service) QuotationFile(ctx context.Context, id int64) (*Quotation, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	q, err := s.store.quotation(ctx, id, true)
	if err != nil {
		return nil, err
	}
	if q.FileSize == 0 {
		return nil, notFound("у КП нет файла")
	}
	if err := s.seesLot(ctx, a, q.LotID); err != nil {
		return nil, err
	}
	return q, nil
}

func (s *Service) DocumentFile(ctx context.Context, id int64) (*Document, error) {
	a, err := s.begin(ctx)
	if err != nil {
		return nil, err
	}
	d, err := s.store.document(ctx, id, true)
	if err != nil {
		return nil, err
	}
	if err := s.seesLot(ctx, a, d.LotID); err != nil {
		return nil, err
	}
	return d, nil
}
