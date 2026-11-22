package models

type ServiceFormVersion struct {
	ServiceID int64   `gorm:"primaryKey;autoIncrement:false"`
	Version   int64   `gorm:"primaryKey;autoIncrement:false"`
	Schema    string  `gorm:"type:jsonb;not null"`
	Service   Service `gorm:"constraint:fk_service_form_versions_service,OnDelete:CASCADE"`
}
