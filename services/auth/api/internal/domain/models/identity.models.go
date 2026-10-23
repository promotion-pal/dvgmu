package models

import (
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	"fesmu/contract/auth/v2"
)

type Identity struct {
	ID    int64  `gorm:"column:id;primaryKey;autoIncrement"`
	MDMID int64  `gorm:"column:mdm_id;index"`
	Email string `gorm:"column:email;index"`

	Login      string    `gorm:"column:login;index"`
	ObjectGUID string    `gorm:"column:object_guid;uniqueIndex;type:uuid"`
	SyncedAt   time.Time `gorm:"column:synced_at;not null"`
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (Identity) TableName() string { return "identities" }

type MDMLink struct {
	MDMID      int64
	ObjectGUID string
}

type IdentityFilter struct {
	MDMID      int64
	ObjectGUID string
	Email      string
	Login      string
	Linked     *bool

	Page     int
	PageSize int
}

func (i *Identity) ToProto() *authv2.Identity {
	return &authv2.Identity{
		Id:         i.ID,
		MdmId:      i.MDMID,
		ObjectGuid: i.ObjectGUID,
		Email:      i.Email,
		Login:      i.Login,
		SyncedAt:   timestamppb.New(i.SyncedAt),
		CreatedAt:  timestamppb.New(i.CreatedAt),
		UpdatedAt:  timestamppb.New(i.UpdatedAt),
	}
}
