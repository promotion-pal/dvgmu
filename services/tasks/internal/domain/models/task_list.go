package models

import "time"

type TaskListItem struct {
	UUID         string
	Number       string
	Title        string
	CreatedAt    time.Time
	ServiceID    int64
	ServiceName  string
	StatusID     int64
	StatusName   string
	PriorityID   int64
	PriorityName string
}

type TaskDetails struct {
	TaskListItem `gorm:"embedded"`
	Description  string
	DirectionID  int64
	UpdatedAt    time.Time
	Version      int64
	FormVersion  int64
	ExtraFields  string
	FormSchema   *string
}

type TaskListCursor struct {
	CreatedAt time.Time
	UUID      string
}

type TaskListFilter struct {
	ServiceID     *int64
	StatusID      *int64
	PriorityID    *int64
	CreatedFrom   *time.Time
	CreatedBefore *time.Time
}
