package storage

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	pb "fesmu/contract/fesmu/service/v1"
	"dvgmu/api/internal/domain/models"
)

type CertificateStorage struct {
	db *gorm.DB
}

func CertificateStorageNew(db *gorm.DB) *CertificateStorage {
	return &CertificateStorage{db: db}
}

func (s *CertificateStorage) CertificateOrderCreate(ctx context.Context, o *models.CertificateOrder) error {
	return s.db.WithContext(ctx).Create(o).Error
}

// CertificateOrderFetch — журнал, новые сверху; status UNSPECIFIED — все.
func (s *CertificateStorage) CertificateOrderFetch(ctx context.Context, status pb.CertificateOrderStatus) ([]*models.CertificateOrder, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC, id DESC")
	if status != pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_UNSPECIFIED {
		q = q.Where("status = ?", status)
	}
	var out []*models.CertificateOrder
	if err := q.Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

func (s *CertificateStorage) CertificateOrderByID(ctx context.Context, id int64) (*models.CertificateOrder, error) {
	var o models.CertificateOrder
	if err := s.db.WithContext(ctx).First(&o, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, models.ErrCertificateOrderNotFound
		}
		return nil, err
	}
	return &o, nil
}

// CertificateOrderMarkIssued — выдана; повторная выдача (перепечатка) не
// меняет, кто и когда выдал впервые.
func (s *CertificateStorage) CertificateOrderMarkIssued(ctx context.Context, id int64, by string, at time.Time) error {
	return s.db.WithContext(ctx).Model(&models.CertificateOrder{}).
		Where("id = ? AND status = ?", id, pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ORDERED).
		Updates(map[string]any{"status": pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ISSUED, "issued_by": by, "issued_at": at}).Error
}
