package library

import (
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "dvgmu/api/contract/gen/go/entity/v2"
	enum "dvgmu/api/contract/gen/go/enum/v2"
)

// File is a file the module stored in the files service; ID is its id there.
type File struct {
	ID        int64  `gorm:"primaryKey;autoIncrement:false"`
	Name      string `gorm:"size:512;not null"`
	MimeType  string `gorm:"size:255;not null;default:''"`
	Size      int64  `gorm:"not null;default:0"`
	CreatedBy string `gorm:"size:255;not null;default:''"`
	CreatedAt time.Time
}

func (File) TableName() string { return "library_files" }

func (f *File) toProto() *entity.LibraryFile {
	if f == nil {
		return nil
	}
	return &entity.LibraryFile{Id: f.ID, Name: f.Name, MimeType: f.MimeType, Size: f.Size}
}

// Item is a catalog entry: an edition stored as a file or a link.
type Item struct {
	ID          int64                `gorm:"primaryKey;autoIncrement"`
	Kind        enum.LibraryItemKind `gorm:"not null"`
	Title       string               `gorm:"size:512;not null"`
	Authors     string               `gorm:"size:512;not null;default:''"`
	Year        int32                `gorm:"not null;default:0"`
	Publisher   string               `gorm:"size:255;not null;default:''"`
	Description string               `gorm:"size:8192;not null;default:''"`
	Discipline  string               `gorm:"size:255;not null;default:'';index"`
	FileID      *int64               `gorm:"index"`
	File        *File                `gorm:"foreignKey:FileID;constraint:OnDelete:SET NULL"`
	URL         string               `gorm:"size:2048;not null;default:''"`
	CreatedBy   string               `gorm:"size:255;not null;default:''"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (Item) TableName() string { return "library_items" }

func (i *Item) toProto() *entity.LibraryItem {
	return &entity.LibraryItem{
		Id:          i.ID,
		Kind:        i.Kind,
		Title:       i.Title,
		Authors:     i.Authors,
		Year:        i.Year,
		Publisher:   i.Publisher,
		Description: i.Description,
		Discipline:  i.Discipline,
		File:        i.File.toProto(),
		Url:         i.URL,
		CreatedBy:   i.CreatedBy,
		CreatedAt:   timestamppb.New(i.CreatedAt),
		UpdatedAt:   timestamppb.New(i.UpdatedAt),
	}
}

// Manual is a study manual. Draft and Published are its sections as
// protojson (blocks.go); Published is empty until the first publishing.
type Manual struct {
	ID           int64             `gorm:"primaryKey;autoIncrement"`
	Discipline   string            `gorm:"size:255;not null;index"`
	Title        string            `gorm:"size:512;not null"`
	Specialty    string            `gorm:"size:255;not null;default:''"`
	Course       int32             `gorm:"not null;default:0"`
	Semester     int32             `gorm:"not null;default:0"`
	Authors      string            `gorm:"size:512;not null;default:''"`
	Annotation   string            `gorm:"size:4096;not null;default:''"`
	Status       enum.ManualStatus `gorm:"not null"`
	Draft        []byte            `gorm:"type:jsonb;not null"`
	Published    []byte            `gorm:"type:jsonb"`
	DraftChanged bool              `gorm:"not null;default:false"`
	UpdatedBy    string            `gorm:"size:255;not null;default:''"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
	PublishedAt  *time.Time
}

func (Manual) TableName() string { return "library_manuals" }

// toProto leaves sections out (lists); draftChanged only for editors.
func (m *Manual) toProto(editor bool) *entity.Manual {
	out := &entity.Manual{
		Id:           m.ID,
		Discipline:   m.Discipline,
		Title:        m.Title,
		Specialty:    m.Specialty,
		Course:       m.Course,
		Semester:     m.Semester,
		Authors:      m.Authors,
		Annotation:   m.Annotation,
		Status:       m.Status,
		DraftChanged: editor && m.DraftChanged,
		UpdatedAt:    timestamppb.New(m.UpdatedAt),
	}
	if editor {
		out.UpdatedBy = m.UpdatedBy
	}
	if m.PublishedAt != nil {
		out.PublishedAt = timestamppb.New(*m.PublishedAt)
	}
	return out
}

// Progress is where a user stopped in an edition or a manual.
type Progress struct {
	UserUUID  string                `gorm:"primaryKey;size:64"`
	Kind      enum.ReaderSourceKind `gorm:"primaryKey"`
	RefID     int64                 `gorm:"primaryKey;autoIncrement:false"`
	Position  string                `gorm:"size:255;not null;default:''"`
	Percent   int32                 `gorm:"not null;default:0"`
	UpdatedAt time.Time             `gorm:"index"`
}

func (Progress) TableName() string { return "library_progress" }

// Tables lists the module's tables for the migration loader.
func Tables() []any {
	return []any{&File{}, &Item{}, &Manual{}, &Progress{}}
}
