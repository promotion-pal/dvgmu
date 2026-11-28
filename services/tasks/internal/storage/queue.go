package storage

import (
	"context"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type QueueStorage struct {
	db *gorm.DB
}

func NewQueueStorage(db *gorm.DB) *QueueStorage {
	return &QueueStorage{db: db}
}

func (s *QueueStorage) Create(ctx context.Context, queue *models.Queue) error {
	return s.db.WithContext(ctx).Create(queue).Error
}

func (s *QueueStorage) Get(ctx context.Context, code string) (models.Queue, error) {
	var queue models.Queue
	err := s.db.WithContext(ctx).Take(&queue, "code = ?", code).Error
	return queue, err
}

func (s *QueueStorage) List(ctx context.Context, afterCode string, active *bool, limit int) ([]models.Queue, error) {
	return listQueues(s.db.WithContext(ctx).Model(&models.Queue{}), afterCode, active, limit)
}

func (s *QueueStorage) ListMine(ctx context.Context, viewerID, afterCode string, active *bool, limit int) ([]models.Queue, error) {
	query := s.db.WithContext(ctx).Model(&models.Queue{}).
		Joins("JOIN queue_view_access ON queue_view_access.queue_code = queues.code").
		Where("queue_view_access.user_uuid = ?", viewerID)
	return listQueues(query, afterCode, active, limit)
}

func listQueues(query *gorm.DB, afterCode string, active *bool, limit int) ([]models.Queue, error) {
	var queues []models.Queue
	query = query.Where("queues.code > ?", afterCode)
	if active != nil {
		query = query.Where("queues.active = ?", *active)
	}
	err := query.Order("queues.code ASC").Limit(limit).Find(&queues).Error
	return queues, err
}

func (s *QueueStorage) Update(ctx context.Context, code string, changes map[string]any) (models.Queue, error) {
	var queue models.Queue
	result := s.db.WithContext(ctx).Model(&queue).Clauses(clause.Returning{}).
		Where("code = ?", code).Updates(changes)
	if result.Error != nil {
		return queue, result.Error
	}
	if result.RowsAffected == 0 {
		return queue, gorm.ErrRecordNotFound
	}
	return queue, nil
}

func (s *QueueStorage) GrantViewAccess(ctx context.Context, code, userUUID string) error {
	grant := models.QueueViewAccess{QueueCode: code, UserUUID: userUUID}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&grant).Error
}

func (s *QueueStorage) ListViewAccess(ctx context.Context, code, afterUserUUID string, limit int) ([]string, error) {
	userUUIDs := make([]string, 0, limit)
	query := s.db.WithContext(ctx).Model(&models.QueueViewAccess{}).Where("queue_code = ?", code)
	if afterUserUUID != "" {
		query = query.Where("user_uuid > ?", afterUserUUID)
	}
	err := query.Order("user_uuid ASC").Limit(limit).Pluck("user_uuid", &userUUIDs).Error
	return userUUIDs, err
}

func (s *QueueStorage) RevokeViewAccess(ctx context.Context, code, userUUID string) error {
	return s.db.WithContext(ctx).Delete(&models.QueueViewAccess{}, "queue_code = ? AND user_uuid = ?", code, userUUID).Error
}

func lockRouteQueues(tx *gorm.DB, codes []string) (map[string]bool, error) {
	var queues []models.Queue
	err := tx.Select("code", "active").Clauses(clause.Locking{Strength: "SHARE"}).
		Where("code IN ?", codes).Order("code ASC").Find(&queues).Error
	if err != nil {
		return nil, err
	}
	active := make(map[string]bool, len(queues))
	for _, queue := range queues {
		active[queue.Code] = queue.Active
	}
	return active, nil
}
