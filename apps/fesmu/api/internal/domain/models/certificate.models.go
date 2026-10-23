package models

import (
	"errors"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	fileenum "dvgmu/api/contract/gen/go/file/enum"
	pb "dvgmu/api/contract/gen/go/service/v1"
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
}

func (CertificateOrder) TableName() string { return "certificate_orders" }

func (o *CertificateOrder) ToProto() *pb.CertificateOrderEntry {
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
	}
	if o.IssuedAt != nil {
		e.IssuedAt = timestamppb.New(*o.IssuedAt)
	}
	return e
}
