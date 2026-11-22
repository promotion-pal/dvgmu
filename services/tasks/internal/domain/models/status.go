package models

type Status struct {
	ID        int64  `gorm:"primaryKey;autoIncrement;index:statuses_sort_order_id_idx,priority:2"`
	Code      string `gorm:"type:varchar(64);not null;uniqueIndex:statuses_code_key"`
	Name      string `gorm:"type:varchar(150);not null"`
	SortOrder int32  `gorm:"not null;default:0;index:statuses_sort_order_id_idx,priority:1"`
	Active    bool   `gorm:"not null;default:true"`
	Terminal  bool   `gorm:"not null;default:false"`
}

type StatusCursor struct {
	SortOrder int32
	ID        int64
}
