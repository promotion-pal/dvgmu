package models

type ServiceSettings struct {
	ServiceID         int64    `gorm:"primaryKey;autoIncrement:false"`
	Service           Service  `gorm:"constraint:fk_service_settings_service,OnDelete:CASCADE"`
	InitialStatusID   int64    `gorm:"not null;index:service_settings_initial_status_id_idx"`
	InitialStatus     Status   `gorm:"constraint:fk_service_settings_initial_status,OnDelete:RESTRICT"`
	DefaultPriorityID int64    `gorm:"not null;index:service_settings_default_priority_id_idx"`
	DefaultPriority   Priority `gorm:"constraint:fk_service_settings_default_priority,OnDelete:RESTRICT"`
}
