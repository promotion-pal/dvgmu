package models

type Priority struct {
	ID        int64  `gorm:"primaryKey;autoIncrement;index:priorities_sort_order_id_idx,priority:2"`
	Code      string `gorm:"type:varchar(64);not null;uniqueIndex:priorities_code_key"`
	Name      string `gorm:"type:varchar(150);not null"`
	SortOrder int32  `gorm:"not null;default:0;index:priorities_sort_order_id_idx,priority:1"`
	Active    bool   `gorm:"not null;default:true"`
}

type PriorityCursor struct {
	SortOrder int32
	ID        int64
}
