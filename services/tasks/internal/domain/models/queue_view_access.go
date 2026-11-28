package models

type QueueViewAccess struct {
	QueueCode string `gorm:"type:varchar(64);primaryKey"`
	UserUUID  string `gorm:"type:uuid;primaryKey"`
	Queue     Queue  `gorm:"foreignKey:QueueCode;references:Code;constraint:fk_queue_view_access_queue,OnDelete:RESTRICT"`
}

func (QueueViewAccess) TableName() string { return "queue_view_access" }
