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

const (
	statusOrdered   = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ORDERED
	statusReady     = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_READY
	statusIssued    = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_ISSUED
	statusCancelled = pb.CertificateOrderStatus_CERTIFICATE_ORDER_STATUS_CANCELLED
)

// CertificateOrderFetchByStudent — заказы студента, новые сверху.
func (s *CertificateStorage) CertificateOrderFetchByStudent(ctx context.Context, studentID int64) ([]*models.CertificateOrder, error) {
	var out []*models.CertificateOrder
	err := s.db.WithContext(ctx).Where("student_mdm_id = ?", studentID).Order("created_at DESC, id DESC").Find(&out).Error
	return out, err
}

// CertificateOrderSetFaculty — факультет, группа и зачётка заказа (уточнение
// старых заказов, заведённых до учёта факультета).
func (s *CertificateStorage) CertificateOrderSetFaculty(ctx context.Context, id int64, faculty int32, group, recordBook string) error {
	return s.db.WithContext(ctx).Model(&models.CertificateOrder{}).Where("id = ?", id).
		Updates(map[string]any{"faculty_code": faculty, "group": group, "record_book": recordBook}).Error
}

// CertificateOrderMarkReady — напечатана, ждёт студента. Только из «заказана»:
// перепечатка не меняет, кто и когда напечатал впервые.
func (s *CertificateStorage) CertificateOrderMarkReady(ctx context.Context, id int64, by string, at time.Time) error {
	return s.db.WithContext(ctx).Model(&models.CertificateOrder{}).
		Where("id = ? AND status = ?", id, statusOrdered).
		Updates(map[string]any{"status": statusReady, "prepared_by": by, "ready_at": at}).Error
}

// CertificateOrderMarkIssued — выдана (студент расписался). Из «заказана» или
// «готова»; повторная отметка не меняет, кто и когда выдал впервые.
func (s *CertificateStorage) CertificateOrderMarkIssued(ctx context.Context, id int64, by string, at time.Time) error {
	return s.db.WithContext(ctx).Model(&models.CertificateOrder{}).
		Where("id = ? AND status IN ?", id, []pb.CertificateOrderStatus{statusOrdered, statusReady}).
		Updates(map[string]any{"status": statusIssued, "issued_by": by, "issued_at": at}).Error
}

// CertificateOrderCancel — отклонена с причиной. Выданную отклонить нельзя.
func (s *CertificateStorage) CertificateOrderCancel(ctx context.Context, id int64, reason, by string) error {
	return s.db.WithContext(ctx).Model(&models.CertificateOrder{}).
		Where("id = ? AND status IN ?", id, []pb.CertificateOrderStatus{statusOrdered, statusReady}).
		Updates(map[string]any{"status": statusCancelled, "cancel_reason": reason, "prepared_by": by}).Error
}
