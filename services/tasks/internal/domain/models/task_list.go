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
