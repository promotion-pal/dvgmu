package models

import "time"

type MyTaskListItem struct {
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

type MyTaskDetails struct {
	MyTaskListItem `gorm:"embedded"`
	Description    string
	DirectionID    int64
	UpdatedAt      time.Time
	Version        int64
	FormVersion    int64
	ExtraFields    string
	FormSchema     *string
}

type MyTasksCursor struct {
	CreatedAt time.Time
	UUID      string
}

type MyTasksFilter struct {
	ServiceID     *int64
	StatusID      *int64
	PriorityID    *int64
	CreatedFrom   *time.Time
	CreatedBefore *time.Time
}
