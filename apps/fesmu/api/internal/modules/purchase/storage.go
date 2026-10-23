package purchase

import (
	"context"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	enum "dvgmu/api/contract/gen/go/enum/v2"
)

// storage reads and writes purchase_db. Inside tx, db is the transaction.
type storage struct {
	db *gorm.DB
}

// quotationColumns leave the file out: it is read only on download.
const quotationColumns = "id, lot_id, supplier, unit_price, note, file_name, file_size, created_by, created_at"

func (s *storage) tx(ctx context.Context, fn func(tx *storage) error) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return fn(&storage{db: tx})
	})
}

func (s *storage) curators(ctx context.Context) ([]*Curator, error) {
	var list []*Curator
	err := s.db.WithContext(ctx).Order("sort_order, id").Find(&list).Error
	return list, err
}

func (s *storage) curatorExists(ctx context.Context, id int64) (bool, error) {
	var n int64
	err := s.db.WithContext(ctx).Model(&Curator{}).Where("id = ?", id).Count(&n).Error
	return n > 0, err
}

func (s *storage) requests(ctx context.Context) ([]*Request, error) {
	var list []*Request
	err := s.db.WithContext(ctx).Order("created_at DESC, id DESC").Find(&list).Error
	return list, err
}

// requestsLocked reads ids under a row lock, in id order.
func (s *storage) requestsLocked(ctx context.Context, ids []int64) ([]*Request, error) {
	var list []*Request
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id IN ?", ids).Order("id").Find(&list).Error
	return list, err
}

func (s *storage) requestLocked(ctx context.Context, id int64) (*Request, error) {
	var r Request
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&r, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("заявка не найдена")
	}
	return &r, err
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
	if err := s.deleteLogs(ctx, enum.PurchaseLogTarget_PURCHASE_LOG_TARGET_REQUEST, id); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(&Request{}, "id = ?", id).Error
}

func (s *storage) lots(ctx context.Context) ([]*Lot, error) {
	var list []*Lot
	err := s.db.WithContext(ctx).
		Preload("Quotations", func(db *gorm.DB) *gorm.DB { return db.Select(quotationColumns).Order("id") }).
		Order("created_at DESC, id DESC").Find(&list).Error
	return list, err
}

// lotLocked reads a purchase under a row lock, with its offers.
func (s *storage) lotLocked(ctx context.Context, id int64) (*Lot, error) {
	var l Lot
	err := s.db.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).First(&l, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("закупка не найдена")
	}
	if err != nil {
		return nil, err
	}
	err = s.db.WithContext(ctx).Select(quotationColumns).Where("lot_id = ?", id).Order("id").Find(&l.Quotations).Error
	return &l, err
}

func (s *storage) createLot(ctx context.Context, l *Lot) error {
	return s.db.WithContext(ctx).Omit(clause.Associations).Create(l).Error
}

func (s *storage) saveLot(ctx context.Context, l *Lot) error {
	return s.db.WithContext(ctx).Omit(clause.Associations).Save(l).Error
}

// deleteLot removes a purchase, its offers (by cascade) and its log.
func (s *storage) deleteLot(ctx context.Context, id int64) error {
	if err := s.deleteLogs(ctx, enum.PurchaseLogTarget_PURCHASE_LOG_TARGET_LOT, id); err != nil {
		return err
	}
	return s.db.WithContext(ctx).Delete(&Lot{}, "id = ?", id).Error
}

func (s *storage) createQuotation(ctx context.Context, q *Quotation) error {
	return s.db.WithContext(ctx).Create(q).Error
}

func (s *storage) quotation(ctx context.Context, id int64, withFile bool) (*Quotation, error) {
	q := s.db.WithContext(ctx)
	if !withFile {
		q = q.Select(quotationColumns)
	}
	var out Quotation
	err := q.First(&out, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("КП не найдено")
	}
	return &out, err
}

func (s *storage) deleteQuotation(ctx context.Context, id int64) error {
	return s.db.WithContext(ctx).Delete(&Quotation{}, "id = ?", id).Error
}

func (s *storage) logs(ctx context.Context) ([]*Log, error) {
	var list []*Log
	err := s.db.WithContext(ctx).Order("created_at, id").Find(&list).Error
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

func (s *storage) departments(ctx context.Context) ([]*Department, error) {
	var list []*Department
	err := s.db.WithContext(ctx).Order("id").Find(&list).Error
	return list, err
}

func (s *storage) department(ctx context.Context, id int32) (*Department, error) {
	var d Department
	err := s.db.WithContext(ctx).First(&d, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("отдел не найден в справочнике")
	}
	return &d, err
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
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return notFound("категория не найдена")
	}
	return nil
}

func (s *storage) curator(ctx context.Context, id int64) (*Curator, error) {
	var c Curator
	err := s.db.WithContext(ctx).First(&c, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, notFound("проректор не найден")
	}
	return &c, err
}

// curatorByUser is the vice-rector bound to the portal user uuid; 0 if none.
func (s *storage) curatorByUser(ctx context.Context, uuid string) (int64, error) {
	if uuid == "" {
		return 0, nil
	}
	var c Curator
	err := s.db.WithContext(ctx).Select("id").Where("user_uuid = ?", uuid).Order("id").First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, nil
	}
	return c.ID, err
}

func (s *storage) saveCurator(ctx context.Context, c *Curator) error {
	return s.db.WithContext(ctx).Save(c).Error
}
