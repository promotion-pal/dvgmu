package models

import (
	"errors"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	fileenum "fesmu/contract/file/enum"
	pb "fesmu/contract/fesmu/service/v1"
)

var ErrCertificateOrderNotFound = errors.New("certificate order not found")

// CertificateOrder — строка журнала справок.
type CertificateOrder struct {
	ID           int64 `gorm:"primaryKey;autoIncrement"`
	StudentMdmID int64
	StudentName  string
	Type         fileenum.FileGenerateType `gorm:"type:integer"`
	Copies       int32
	Status       pb.CertificateOrderStatus `gorm:"type:smallint"`
	OrderedBy    string
	IssuedBy     string
	IssuedAt     *time.Time
	CreatedAt    time.Time

	// Факультет по зачётке на момент заказа (0 — не определён), снимок группы
	// и зачётки — для журнала деканата.
	FacultyCode  int32
	Group        string
	RecordBook   string
	PreparedBy   string
	ReadyAt      *time.Time
	CancelReason string
}

func (CertificateOrder) TableName() string { return "certificate_orders" }

// ToProto — facultyLabel передаёт пакет certificate (там правило факультетов).
func (o *CertificateOrder) ToProto(facultyLabel func(int32) string) *pb.CertificateOrderEntry {
	e := &pb.CertificateOrderEntry{
		Id:           o.ID,
		StudentMdmId: o.StudentMdmID,
		StudentName:  o.StudentName,
		Type:         o.Type,
		Copies:       o.Copies,
		Status:       o.Status,
		OrderedBy:    o.OrderedBy,
		CreatedAt:    timestamppb.New(o.CreatedAt),
		IssuedBy:     o.IssuedBy,
		Faculty:      facultyLabel(o.FacultyCode),
		Group:        o.Group,
		RecordBook:   o.RecordBook,
		PreparedBy:   o.PreparedBy,
		CancelReason: o.CancelReason,
	}
	if o.IssuedAt != nil {
		e.IssuedAt = timestamppb.New(*o.IssuedAt)
	}
	if o.ReadyAt != nil {
		e.ReadyAt = timestamppb.New(*o.ReadyAt)
	}
	return e
}
