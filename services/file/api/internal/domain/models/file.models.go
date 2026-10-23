package models

import (
	"dvgmu/file/contract/gen/go/entity"
	"dvgmu/file/contract/gen/go/enum"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type File struct {
	ID     int64 `gorm:"primaryKey;autoIncrement"`
	UserID int64

	FileSize     int64
	FileName     string
	RelativePath string `gorm:"column:relative_path"`
	MimeType     string `gorm:"column:mime_type"`
	Type         enum.FileType

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (f *File) ToProto() *entity.File {
	if f == nil {
		return nil
	}
	return &entity.File{
		Id:     f.ID,
		UserId: f.UserID,

		FileName: f.FileName,
		FileSize: f.FileSize,

		Type:     f.Type,
		MimeType: f.MimeType,

		CreatedAt: timestamppb.New(f.CreatedAt),
		UpdatedAt: timestamppb.New(f.UpdatedAt),
	}
}
