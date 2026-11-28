package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"dvgmu/tasks/internal/domain/models"
	"dvgmu/tasks/internal/storage"
	"github.com/google/uuid"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
)

var (
	ErrInvalidTask           = errors.New("invalid task")
	ErrTaskApplicantRequired = errors.New("applicant identity is required")
)

type TaskRegistration struct {
	ServiceID      int64
	FormVersion    int64
	Title          string
	Description    string
	ExtraFields    *structpb.Struct
	IdempotencyKey string
}

type TaskService struct {
	storage        *storage.TaskStorage
	numberLocation *time.Location
}

func NewTaskService(storage *storage.TaskStorage, numberLocation *time.Location) *TaskService {
	return &TaskService{storage: storage, numberLocation: numberLocation}
}

func (s *TaskService) GetMine(ctx context.Context, applicantID, taskUUID string) (models.TaskDetails, error) {
	id, err := validateTaskLookup(applicantID, taskUUID)
	if err != nil {
		return models.TaskDetails{}, err
	}
	return s.storage.GetMine(ctx, applicantID, id)
}

func (s *TaskService) GetInQueue(ctx context.Context, viewerID, queueCode, taskUUID string) (models.TaskDetails, error) {
	id, err := validateTaskLookup(viewerID, taskUUID)
	if err != nil {
		return models.TaskDetails{}, err
	}
	queueCode = strings.TrimSpace(queueCode)
	if !validQueueLookupCode(queueCode) {
		return models.TaskDetails{}, fmt.Errorf("%w: provide a valid queue_code", ErrInvalidTask)
	}
	return s.storage.GetInQueue(ctx, viewerID, queueCode, id)
}

func (s *TaskService) GetHistoryMine(ctx context.Context, applicantID, taskUUID string) ([]models.MyTaskHistoryEvent, error) {
	id, err := validateTaskLookup(applicantID, taskUUID)
	if err != nil {
		return nil, err
	}
	return s.storage.GetHistoryMine(ctx, applicantID, id)
}

func validateTaskLookup(userID, taskUUID string) (string, error) {
	if strings.TrimSpace(userID) == "" {
		return "", ErrTaskApplicantRequired
	}
	id, err := uuid.Parse(taskUUID)
	if err != nil || id == uuid.Nil {
		return "", fmt.Errorf("%w: uuid must be a valid task UUID", ErrInvalidTask)
	}
	return id.String(), nil
}

func (s *TaskService) ListMine(ctx context.Context, applicantID string, filter models.TaskListFilter, after *models.TaskListCursor, pageSize int32) ([]models.TaskListItem, *models.TaskListCursor, error) {
	if strings.TrimSpace(applicantID) == "" {
		return nil, nil, ErrTaskApplicantRequired
	}
	limit, err := taskListPageSize(filter, pageSize)
	if err != nil {
		return nil, nil, err
	}
	tasks, err := s.storage.ListMine(ctx, applicantID, filter, after, limit+1)
	if err != nil {
		return nil, nil, fmt.Errorf("list tasks by author: %w", err)
	}
	page, next := taskListPage(tasks, limit)
	return page, next, nil
}

func (s *TaskService) ListQueue(ctx context.Context, viewerID, queueCode string, filter models.TaskListFilter, after *models.TaskListCursor, pageSize int32) ([]models.TaskListItem, *models.TaskListCursor, error) {
	if strings.TrimSpace(viewerID) == "" {
		return nil, nil, ErrTaskApplicantRequired
	}
	queueCode = strings.TrimSpace(queueCode)
	if !validQueueLookupCode(queueCode) {
		return nil, nil, fmt.Errorf("%w: provide a valid queue_code", ErrInvalidTask)
	}
	limit, err := taskListPageSize(filter, pageSize)
	if err != nil {
		return nil, nil, err
	}
	tasks, err := s.storage.ListQueue(ctx, viewerID, queueCode, filter, after, limit+1)
	if err != nil {
		return nil, nil, err
	}
	page, next := taskListPage(tasks, limit)
	return page, next, nil
}

func taskListPageSize(filter models.TaskListFilter, pageSize int32) (int, error) {
	if pageSize < 0 || pageSize > 100 {
		return 0, fmt.Errorf("%w: page_size must be between 0 and 100", ErrInvalidTask)
	}
	if (filter.ServiceID != nil && *filter.ServiceID <= 0) ||
		(filter.StatusID != nil && *filter.StatusID <= 0) ||
		(filter.PriorityID != nil && *filter.PriorityID <= 0) {
		return 0, fmt.Errorf("%w: filter IDs must be positive", ErrInvalidTask)
	}
	if filter.CreatedFrom != nil && filter.CreatedBefore != nil && !filter.CreatedFrom.Before(*filter.CreatedBefore) {
		return 0, fmt.Errorf("%w: created_from must be before created_before", ErrInvalidTask)
	}
	if pageSize == 0 {
		return 50, nil
	}
	return int(pageSize), nil
}

func taskListPage(tasks []models.TaskListItem, limit int) ([]models.TaskListItem, *models.TaskListCursor) {
	if len(tasks) <= limit {
		return tasks, nil
	}
	last := tasks[limit-1]
	return tasks[:limit], &models.TaskListCursor{CreatedAt: last.CreatedAt, UUID: last.UUID}
}

func (s *TaskService) Create(ctx context.Context, input TaskRegistration, applicantID, departmentID string) (models.Task, error) {
	if strings.TrimSpace(applicantID) == "" {
		return models.Task{}, ErrTaskApplicantRequired
	}
	title := strings.TrimSpace(input.Title)
	if input.ServiceID <= 0 || input.FormVersion < 0 {
		return models.Task{}, fmt.Errorf("%w: provide a positive service_id and a valid form_version", ErrInvalidTask)
	}
	if !validCatalogName(title) {
		return models.Task{}, fmt.Errorf("%w: title must contain 1 to 150 characters", ErrInvalidTask)
	}
	key := strings.TrimSpace(input.IdempotencyKey)
	if key == "" || len(key) > 128 || strings.ContainsRune(key, 0) {
		return models.Task{}, fmt.Errorf("%w: idempotency_key must contain 1 to 128 bytes", ErrInvalidTask)
	}
	if strings.ContainsRune(input.Description, 0) {
		return models.Task{}, fmt.Errorf("%w: invalid description", ErrInvalidTask)
	}
	extra := input.ExtraFields
	if extra == nil {
		extra = &structpb.Struct{}
	}
	now := time.Now().UTC()
	task := models.Task{
		Title:                        title,
		Description:                  strings.TrimSpace(input.Description),
		AuthorID:                     applicantID,
		AuthorDepartmentIDAtCreation: departmentID,
		CreatedAt:                    now,
		UpdatedAt:                    now,
	}
	// Validation and persistence use the same form snapshot under the storage transaction.
	validate := func(schema string) error {
		return validateTaskFields(schema, extra.Fields)
	}
	encoded, err := protojson.Marshal(extra)
	if err != nil {
		return models.Task{}, fmt.Errorf("%w: invalid extra fields", ErrInvalidTask)
	}
	task.ExtraFields = string(encoded)
	fingerprint, err := taskFingerprint(input.ServiceID, input.FormVersion, task.Title, task.Description, extra)
	if err != nil {
		return models.Task{}, fmt.Errorf("encode task fingerprint: %w", err)
	}
	registration := models.TaskRegistrationKey{AuthorID: applicantID, Key: key, Fingerprint: fingerprint}
	return s.storage.Create(ctx, task, registration, input.ServiceID, input.FormVersion, now.In(s.numberLocation).Year(), validate)
}

func taskFingerprint(serviceID, formVersion int64, title, description string, fields *structpb.Struct) (string, error) {
	// Deterministic encoding preserves value types and ignores the order of object keys.
	extra, err := (proto.MarshalOptions{Deterministic: true}).Marshal(fields)
	if err != nil {
		return "", err
	}
	input := struct {
		ServiceID   int64
		FormVersion int64
		Title       string
		Description string
		ExtraFields []byte
	}{serviceID, formVersion, title, description, extra}
	encoded, err := json.Marshal(input)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(encoded)
	return hex.EncodeToString(digest[:]), nil
}
