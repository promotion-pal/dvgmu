package models

import "time"

type Task struct {
	ID        int64     `gorm:"primaryKey;autoIncrement"`
	UUID      string    `gorm:"type:uuid;not null;default:gen_random_uuid();uniqueIndex:tasks_uuid_key;index:tasks_author_created_uuid_idx,priority:3"`
	Number    string    `gorm:"type:text;not null;uniqueIndex:tasks_number_key"`
	Title     string    `gorm:"type:varchar(150);not null"`
	Version   int64     `gorm:"not null;default:1"`
	CreatedAt time.Time `gorm:"not null;index:tasks_author_created_uuid_idx,priority:2"`
	UpdatedAt time.Time `gorm:"not null"`

	DirectionID                  *int64
	Direction                    Direction `gorm:"constraint:fk_tasks_direction,OnDelete:RESTRICT"`
	ServiceID                    *int64
	Service                      Service `gorm:"constraint:fk_tasks_service,OnDelete:RESTRICT"`
	StatusID                     *int64
	Status                       Status `gorm:"constraint:fk_tasks_status,OnDelete:RESTRICT"`
	PriorityID                   *int64
	Priority                     Priority `gorm:"constraint:fk_tasks_priority,OnDelete:RESTRICT"`
	FormVersion                  *int64
	ServiceForm                  ServiceFormVersion `gorm:"foreignKey:ServiceID,FormVersion;references:ServiceID,Version;constraint:fk_tasks_service_form,OnDelete:RESTRICT"`
	Description                  string             `gorm:"type:text;not null;default:''"`
	AuthorID                     string             `gorm:"type:text;index:tasks_author_created_uuid_idx,priority:1"`
	AuthorDepartmentIDAtCreation string             `gorm:"type:text"`
	ExtraFields                  string             `gorm:"type:jsonb;not null;default:'{}'"`
	QueueID                      *string            `gorm:"type:text"`
	RoutingOutcome               RouteOutcome       `gorm:"type:text"`
}

type TaskNumberCounter struct {
	Year      int32 `gorm:"primaryKey;autoIncrement:false"`
	LastValue int64 `gorm:"not null"`
}

type TaskRegistrationKey struct {
	AuthorID    string `gorm:"type:text;primaryKey"`
	Key         string `gorm:"type:varchar(128);primaryKey"`
	Fingerprint string `gorm:"type:text;not null"`
	TaskID      *int64 `gorm:"index:task_registration_keys_task_id_idx"`
	Task        Task   `gorm:"constraint:fk_task_registration_keys_task,OnDelete:RESTRICT"`
}

type TaskEvent struct {
	ID        int64     `gorm:"primaryKey;autoIncrement;index:task_events_task_id_id_idx,priority:2"`
	TaskID    int64     `gorm:"not null;index:task_events_task_id_id_idx,priority:1"`
	Task      Task      `gorm:"constraint:fk_task_events_task,OnDelete:RESTRICT"`
	Kind      string    `gorm:"type:text;not null"`
	ActorID   *string   `gorm:"type:text"`
	Internal  bool      `gorm:"not null;default:false"`
	Data      string    `gorm:"type:jsonb;not null;default:'{}'"`
	CreatedAt time.Time `gorm:"not null"`
}

type MyTaskHistoryEvent struct {
	Kind      string
	CreatedAt time.Time
}
