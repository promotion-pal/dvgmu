package models

type ServiceRouteRule struct {
	ApplicantDepartmentID string `json:"applicant_department_id,omitempty"`
	QueueID               string `json:"queue_id"`
	Active                bool   `json:"active"`
}

type ServiceRoutes struct {
	ServiceID int64              `gorm:"primaryKey;autoIncrement:false"`
	Service   Service            `gorm:"constraint:fk_service_routes_service,OnDelete:CASCADE"`
	Version   int64              `gorm:"not null"`
	Rules     []ServiceRouteRule `gorm:"type:jsonb;serializer:json;not null"`
}

func (ServiceRoutes) TableName() string {
	return "service_routes"
}
