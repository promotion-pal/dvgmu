package purchasev3

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	enum "fesmu/contract/fesmu/enum/v3"
)

// storage reads and writes purchase_db. Inside tx, db is the transaction.
type storage struct {
	db *gorm.DB
}

// Files are read only on download.
const (
	quotationColumns = "id, lot_id, supplier, supplier_inn, unit_price, note, file_name, file_size, created_by, created_at"
	documentColumns  = "id, lot_id, kind, note, file_name, file_size, created_by, created_at"
	protocolColumns  = "id, number, held_at, chairman, secretary, comment, decisions, file_name, file_size, created_by, created_at"
)

func (s *storage) tx(ctx context.Context, fn func(tx *storage) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&storage{db: tx})
	})
}

func found[T any](v *T, err error, msg string) (*T, error) {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound(msg)
	}
	if err != nil {
		return nil, err
	}
	return v, nil
}

// ── Directories ─────────────────────────────────────────────────────────

func (s *storage) curators(ctx context.Context) ([]*Curator, error) {
	var list []*Curator
	err := s.db.WithContext(ctx).Order("sort_order, id").Find(&list).Error
	return list, err
}

func (s *storage) curator(ctx context.Context, id int64) (*Curator, error) {
	var c Curator
	return found(&c, s.db.WithContext(ctx).First(&c, "id = ?", id).Error, "направление проректора не найдено")
}

// curatorsOfUser are the directions bound to the portal user uuid.
func (s *storage) curatorsOfUser(ctx context.Context, uuid string) ([]int64, error) {
	if uuid == "" || s == nil {
		return nil, nil
	}
	var ids []int64
	err := s.db.WithContext(ctx).Model(&Curator{}).Where("user_uuid = ?", uuid).Order("id").Pluck("id", &ids).Error
	return ids, err
}

func (s *storage) saveCurator(ctx context.Context, c *Curator) error {
	return s.db.WithContext(ctx).Save(c).Error
}

// curatorInUse: departments, requests or purchases refer to the direction.
func (s *storage) curatorInUse(ctx context.Context, id int64) (bool, error) {
	for _, m := range []any{&Department{}, &Request{}, &Lot{}} {
		var n int64
		if err := s.db.WithContext(ctx).Model(m).Where("curator_id = ?", id).Count(&n).Error; err != nil {
			return false, err
		}
		if n > 0 {
			return true, nil
		}
	}
	return false, nil
}

func (s *storage) deleteCurator(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&Curator{}, "id = ?", id)
	if res.Error == nil && res.RowsAffected == 0 {
		return notFound("направление проректора не найдено")
	}
	return res.Error
}

func (s *storage) departments(ctx context.Context) ([]*Department, error) {
	var list []*Department
	err := s.db.WithContext(ctx).Order("id").Find(&list).Error
	return list, err
}

func (s *storage) department(ctx context.Context, id int32) (*Department, error) {
	var d Department
	return found(&d, s.db.WithContext(ctx).First(&d, "id = ?", id).Error, "отдел не найден в справочнике закупок")
}

func (s *storage) saveDepartment(ctx context.Context, d *Department) error {
	return s.db.WithContext(ctx).Omit(clause.Associations).Save(d).Error
}

func (s *storage) categories(ctx context.Context) ([]*Category, error) {
	var list []*Category
	err := s.db.WithContext(ctx).Order("okpd2_prefix, id").Find(&list).Error
	return list, err
}

func (s *storage) saveCategory(ctx context.Context, c *Category) error {
	return s.db.WithContext(ctx).Save(c).Error
}

func (s *storage) deleteCategory(ctx context.Context, id int64) error {
	res := s.db.WithContext(ctx).Delete(&Category{}, "id = ?", id)
	if res.Error == nil && res.RowsAffected == 0 {
		return notFound("вид закупки не найден")
	}
	return res.Error
}

// ── Requests ────────────────────────────────────────────────────────────

func (s *storage) requests(ctx context.Context) ([]*Request, error) {
	var list []*Request
	err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Find(&list).Error
	return list, err
}

func (s *storage) requestLocked(ctx context.Context, id int64) (*Request, error) {
	var r Request
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&r, "id = ?", id).Error
	return found(&r, err, "заявка не найдена")
}

// requestsLocked reads ids under a row lock, in id order.
func (s *storage) requestsLocked(ctx context.Context, ids []int64) ([]*Request, error) {
	var list []*Request
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id IN ?", ids).Order("id").Find(&list).Error
	return list, err
}

func (s *storage) lotRequests(ctx context.Context, lotID int64) ([]*Request, error) {
	var list []*Request
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("lot_id = ?", lotID).Order("id").Find(&list).Error
	return list, err
}

func (s *storage) createRequest(ctx context.Context, r *Request) error {
	return s.db.WithContext(ctx).Omit(clause.Associations).Create(r).Error
}

func (s *storage) saveRequest(ctx context.Context, r *Request) error {
	return s.db.WithContext(ctx).Omit(clause.Associations).Save(r).Error
}

func (s *storage) deleteRequest(ctx context.Context, id int64) error {
	if err := s.deleteLogs(ctx, logRequest, id); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(&Request{}, "id = ?", id).Error
}

// ── Purchases ───────────────────────────────────────────────────────────

func withFiles(db *gorm.DB) *gorm.DB {
	return db.
		Preload("Quotations", func(db *gorm.DB) *gorm.DB { return db.Select(quotationColumns).Order("id") }).
		Preload("Documents", func(db *gorm.DB) *gorm.DB { return db.Select(documentColumns).Order("id") })
}

func (s *storage) lots(ctx context.Context) ([]*Lot, error) {
	var list []*Lot
	err := withFiles(s.db.WithContext(ctx)).Order("created_at DESC, id DESC").Find(&list).Error
	return list, err
}

// lotLocked reads a purchase under a row lock, with its offers and documents.
func (s *storage) lotLocked(ctx context.Context, id int64) (*Lot, error) {
	var l Lot
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&l, "id = ?", id).Error
	if _, err := found(&l, err, "закупка не найдена"); err != nil {
		return nil, err
	}
	db := s.db.WithContext(ctx)
	if err := db.Select(quotationColumns).Where("lot_id = ?", id).Order("id").Find(&l.Quotations).Error; err != nil {
		return nil, err
	}
	err = db.Select(documentColumns).Where("lot_id = ?", id).Order("id").Find(&l.Documents).Error
	return &l, err
}

func (s *storage) createLot(ctx context.Context, l *Lot) error {
	return s.db.WithContext(ctx).Omit(clause.Associations).Create(l).Error
}

func (s *storage) saveLot(ctx context.Context, l *Lot) error {
	return s.db.WithContext(ctx).Omit(clause.Associations).Save(l).Error
}

// deleteLot removes a purchase, its files (by cascade) and its log.
func (s *storage) deleteLot(ctx context.Context, id int64) error {
	if err := s.deleteLogs(ctx, logLot, id); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(&Lot{}, "id = ?", id).Error
}

func (s *storage) createQuotation(ctx context.Context, q *Quotation) error {
	return s.db.WithContext(ctx).Create(q).Error
}

func (s *storage) quotation(ctx context.Context, id int64, withFile bool) (*Quotation, error) {
	db := s.db.WithContext(ctx)
	if !withFile {
		db = db.Select(quotationColumns)
	}
	var q Quotation
	return found(&q, db.First(&q, "id = ?", id).Error, "КП не найдено")
}

func (s *storage) deleteQuotation(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&Quotation{}, "id = ?", id).Error
}

func (s *storage) createDocument(ctx context.Context, d *Document) error {
	return s.db.WithContext(ctx).Create(d).Error
}

func (s *storage) document(ctx context.Context, id int64, withFile bool) (*Document, error) {
	db := s.db.WithContext(ctx)
	if !withFile {
		db = db.Select(documentColumns)
	}
	var d Document
	return found(&d, db.First(&d, "id = ?", id).Error, "документ не найден")
}

func (s *storage) deleteDocument(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&Document{}, "id = ?", id).Error
}

// ── Protocols ───────────────────────────────────────────────────────────

func (s *storage) protocols(ctx context.Context) ([]*Protocol, error) {
	var list []*Protocol
	err := s.db.WithContext(ctx).Select(protocolColumns).Order("held_at DESC, id DESC").Find(&list).Error
	return list, err
}

func (s *storage) protocol(ctx context.Context, id int64, withFile bool) (*Protocol, error) {
	db := s.db.WithContext(ctx)
	if !withFile {
		db = db.Select(protocolColumns)
	}
	var p Protocol
	return found(&p, db.First(&p, "id = ?", id).Error, "протокол не найден")
}

func (s *storage) createProtocol(ctx context.Context, p *Protocol) error {
	return s.db.WithContext(ctx).Create(p).Error
}

// saveProtocol saves the details; the file only when withFile.
func (s *storage) saveProtocol(ctx context.Context, p *Protocol, withFile bool) error {
	db := s.db.WithContext(ctx)
	if !withFile {
		db = db.Omit("file_name", "file_size", "file_content")
	}
	return db.Save(p).Error
}

// ── Log ─────────────────────────────────────────────────────────────────

func (s *storage) logs(ctx context.Context) ([]*Log, error) {
	var list []*Log
	err := s.db.WithContext(ctx).Order("created_at, id").Find(&list).Error
	return list, err
}

// addVisit records an opening of the page, once per user in a minute: a
// double mount or a quick reload is one visit.
func (s *storage) addVisit(ctx context.Context, v *Visit) error {
	var recent int64
	err := s.db.WithContext(ctx).Model(&Visit{}).
		Where("user_uuid = ? AND created_at > ?", v.UserUUID, v.CreatedAt.Add(-time.Minute)).Count(&recent).Error
	if err != nil || recent > 0 {
		return err
	}
	return s.db.WithContext(ctx).Create(v).Error
}

func (s *storage) visits(ctx context.Context, since time.Time) ([]*Visit, error) {
	var list []*Visit
	err := s.db.WithContext(ctx).Where("created_at >= ?", since).Order("created_at, id").Find(&list).Error
	return list, err
}

func (s *storage) addLogs(ctx context.Context, logs ...*Log) error {
	if len(logs) == 0 {
		return nil
	}
	return s.db.WithContext(ctx).Create(logs).Error
}

func (s *storage) deleteLogs(ctx context.Context, target enum.PurchaseLogTarget, id int64) error {
	return s.db.WithContext(ctx).Where("target = ? AND target_id = ?", target, id).Delete(&Log{}).Error
}
