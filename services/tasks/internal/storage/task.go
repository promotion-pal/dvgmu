package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"dvgmu/tasks/internal/domain/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrTaskServiceUnavailable      = errors.New("service or its direction is inactive")
	ErrTaskDefaultsMissing         = errors.New("initial status and default priority are not configured for the service")
	ErrTaskFormChanged             = errors.New("service form version changed")
	ErrTaskRegistrationKeyConflict = errors.New("idempotency key was already used with different task data")
)

type TaskStorage struct {
	db *gorm.DB
}

func NewTaskStorage(db *gorm.DB) *TaskStorage {
	return &TaskStorage{db: db}
}

const myTaskSummaryColumns = `tasks.uuid, tasks.number, tasks.title, tasks.created_at,
	COALESCE(tasks.service_id, 0) AS service_id, COALESCE(services.name, '') AS service_name,
	COALESCE(tasks.status_id, 0) AS status_id, COALESCE(statuses.name, '') AS status_name,
	COALESCE(tasks.priority_id, 0) AS priority_id, COALESCE(priorities.name, '') AS priority_name`

func (s *TaskStorage) myTasksQuery(ctx context.Context, authorID string) *gorm.DB {
	return s.db.WithContext(ctx).Model(&models.Task{}).
		Where("tasks.author_id = ?", authorID)
}

func (s *TaskStorage) myTasksWithCatalog(ctx context.Context, authorID string) *gorm.DB {
	return s.myTasksQuery(ctx, authorID).
		Joins("LEFT JOIN services ON services.id = tasks.service_id").
		Joins("LEFT JOIN statuses ON statuses.id = tasks.status_id").
		Joins("LEFT JOIN priorities ON priorities.id = tasks.priority_id")
}

func (s *TaskStorage) GetMine(ctx context.Context, authorID, taskUUID string) (models.MyTaskDetails, error) {
	var task models.MyTaskDetails
	err := s.myTasksWithCatalog(ctx, authorID).
		Select(myTaskSummaryColumns+`, tasks.description, COALESCE(tasks.direction_id, 0) AS direction_id,
			tasks.updated_at, tasks.version, COALESCE(tasks.form_version, 0) AS form_version,
			tasks.extra_fields, forms.schema AS form_schema`).
		Joins("LEFT JOIN service_form_versions AS forms ON forms.service_id = tasks.service_id AND forms.version = tasks.form_version").
		Where("tasks.uuid = CAST(? AS uuid)", taskUUID).
		Take(&task).Error
	return task, err
}

func (s *TaskStorage) GetHistoryMine(ctx context.Context, authorID, taskUUID string) ([]models.MyTaskHistoryEvent, error) {
	var rows []struct {
		models.MyTaskHistoryEvent `gorm:"embedded"`
		EventID                   *int64
	}
	// The left join keeps the owned task visible even when it has no public events.
	err := s.myTasksQuery(ctx, authorID).
		Select("events.id AS event_id, events.kind, events.created_at").
		Joins("LEFT JOIN task_events AS events ON events.task_id = tasks.id AND events.internal = FALSE").
		Where("tasks.uuid = CAST(? AS uuid)", taskUUID).
		Order("events.created_at ASC, events.id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	if rows[0].EventID == nil {
		return nil, nil
	}
	events := make([]models.MyTaskHistoryEvent, 0, len(rows))
	for _, row := range rows {
		events = append(events, row.MyTaskHistoryEvent)
	}
	return events, nil
}

func (s *TaskStorage) ListMine(ctx context.Context, authorID string, filter models.MyTasksFilter, after *models.MyTasksCursor, limit int) ([]models.MyTaskListItem, error) {
	var tasks []models.MyTaskListItem
	query := s.myTasksWithCatalog(ctx, authorID).Select(myTaskSummaryColumns)
	if filter.ServiceID != nil {
		query = query.Where("tasks.service_id = ?", *filter.ServiceID)
	}
	if filter.StatusID != nil {
		query = query.Where("tasks.status_id = ?", *filter.StatusID)
	}
	if filter.PriorityID != nil {
		query = query.Where("tasks.priority_id = ?", *filter.PriorityID)
	}
	if filter.CreatedFrom != nil {
		query = query.Where("tasks.created_at >= ?", *filter.CreatedFrom)
	}
	if filter.CreatedBefore != nil {
		query = query.Where("tasks.created_at < ?", *filter.CreatedBefore)
	}
	if after != nil {
		query = query.Where("(tasks.created_at, tasks.uuid) < (?, CAST(? AS uuid))", after.CreatedAt, after.UUID)
	}
	err := query.Order("tasks.created_at DESC, tasks.uuid DESC").Limit(limit).Find(&tasks).Error
	return tasks, err
}

func (s *TaskStorage) Create(ctx context.Context, task models.Task, key models.TaskRegistrationKey, serviceID, formVersion int64, year int, validateForm func(string) error) (models.Task, error) {
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := claimTaskRegistrationKey(tx, key)
		if err != nil {
			return err
		}
		if existing != nil {
			task = *existing
			return nil
		}

		var service models.Service
		if err := tx.Select("id", "direction_id", "active").Clauses(clause.Locking{Strength: "SHARE"}).
			Take(&service, serviceID).Error; err != nil {
			return err
		}
		var direction models.Direction
		if err := tx.Select("id", "active").Clauses(clause.Locking{Strength: "SHARE"}).
			Take(&direction, service.DirectionID).Error; err != nil {
			return err
		}
		if !service.Active || !direction.Active {
			return ErrTaskServiceUnavailable
		}

		var settings models.ServiceSettings
		err = tx.Take(&settings, "service_id = ?", serviceID).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrTaskDefaultsMissing
		}
		if err != nil {
			return err
		}
		if err := lockActiveTaskDefaults(tx, settings); err != nil {
			return err
		}

		form, err := readServiceForm(tx, serviceID)
		if err != nil {
			return err
		}
		if form.Version != formVersion {
			return ErrTaskFormChanged
		}
		if err := validateForm(form.Schema); err != nil {
			return err
		}

		routes, err := readServiceRoutes(tx, serviceID)
		if err != nil {
			return err
		}
		// All applicants for the same service use its common route.
		resolution := routes.Resolve("")
		if resolution.Outcome == models.RouteMatched {
			active, err := lockRouteQueues(tx, []string{resolution.QueueID})
			if err != nil {
				return err
			}
			if enabled, exists := active[resolution.QueueID]; !exists {
				resolution.Outcome = models.RouteQueueNotFound
			} else if !enabled {
				resolution.Outcome = models.RouteQueueInactive
			}
		}
		task.ServiceID = &serviceID
		task.DirectionID = &service.DirectionID
		task.StatusID = &settings.InitialStatusID
		task.PriorityID = &settings.DefaultPriorityID
		if formVersion != 0 {
			task.FormVersion = &formVersion
		}
		task.RoutingOutcome = resolution.Outcome
		if resolution.Outcome == models.RouteMatched {
			task.QueueID = &resolution.QueueID
		}

		var sequence int64
		if err := tx.Raw(`
			INSERT INTO task_number_counters (year, last_value) VALUES (?, 1)
			ON CONFLICT (year) DO UPDATE SET last_value = task_number_counters.last_value + 1
			RETURNING last_value`, year).Scan(&sequence).Error; err != nil {
			return err
		}
		task.Number = fmt.Sprintf("REQ-%04d-%05d", year, sequence)
		if err := tx.Create(&task).Error; err != nil {
			return err
		}
		if err := recordTaskRegistration(tx, task, routes.Version); err != nil {
			return err
		}
		return tx.Model(&key).Update("task_id", task.ID).Error
	})
	return task, err
}

func claimTaskRegistrationKey(tx *gorm.DB, key models.TaskRegistrationKey) (*models.Task, error) {
	// A concurrent retry waits for the first transaction to commit or roll back.
	claim := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "author_id"}, {Name: "key"}},
		DoNothing: true,
	}).Create(&key)
	if claim.Error != nil || claim.RowsAffected == 1 {
		return nil, claim.Error
	}

	var saved models.TaskRegistrationKey
	if err := tx.Where(&models.TaskRegistrationKey{AuthorID: key.AuthorID, Key: key.Key}).Take(&saved).Error; err != nil {
		return nil, fmt.Errorf("read task registration key: %w", err)
	}
	if saved.Fingerprint != key.Fingerprint {
		return nil, ErrTaskRegistrationKeyConflict
	}
	if saved.TaskID == nil {
		return nil, errors.New("task registration key has no task")
	}
	var task models.Task
	if err := tx.Take(&task, *saved.TaskID).Error; err != nil {
		return nil, fmt.Errorf("read previously registered task: %w", err)
	}
	return &task, nil
}

func recordTaskRegistration(tx *gorm.DB, task models.Task, routeVersion int64) error {
	data, err := json.Marshal(struct {
		Outcome      models.RouteOutcome `json:"outcome"`
		QueueID      *string             `json:"queue_id,omitempty"`
		RouteVersion int64               `json:"route_version"`
	}{task.RoutingOutcome, task.QueueID, routeVersion})
	if err != nil {
		return err
	}
	events := []models.TaskEvent{
		{TaskID: task.ID, Kind: "registered", ActorID: &task.AuthorID, Data: "{}", CreatedAt: task.CreatedAt},
		{TaskID: task.ID, Kind: "routing_decided", Internal: true, Data: string(data), CreatedAt: task.CreatedAt},
	}
	return tx.Create(&events).Error
}
