package models

import (
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"google.golang.org/protobuf/types/known/timestamppb"

	entity "fesmu/contract/fesmu/entity/v1"
)

// ErrScheduleCollectInvalid wraps every validation failure; the message says which rule broke.
var ErrScheduleCollectInvalid = errors.New("invalid schedule collect entry")

// ScheduleCollect is one lesson row submitted by a teacher through the
// collector page, in the university's schedule exchange format. Every column
// of the format is its own DB column (not a JSON blob): the row has no nested
// structure and a plain table doubles as an easy export.
type ScheduleCollect struct {
	ID string `gorm:"primaryKey;size:64"`

	GroupName    string `gorm:"column:group_name;size:255;not null;index:idx_schedulecollect_group_date,priority:1"`
	StudInLesson int32  `gorm:"not null"`
	Day          int32  `gorm:"not null"`
	Les          int32  `gorm:"not null"`
	Aud          string `gorm:"size:255;not null"`
	Week         int32  `gorm:"not null"`
	Subg         int32  `gorm:"not null"`
	Name         string `gorm:"size:255;not null"`
	CafID        string `gorm:"column:caf_id;size:64;not null"`
	Subject      string `gorm:"size:255;not null"`
	SubjType     string `gorm:"size:64;not null"`
	Date         string `gorm:"size:10;not null;index:idx_schedulecollect_group_date,priority:2"`
	SubjCafID    string `gorm:"column:subj_caf_id;size:64;not null"`
	PrepID       string `gorm:"column:prep_id;size:64;not null"`
	Themas       string `gorm:"type:text;not null;default:''"`

	SubstitutionName      string `gorm:"size:255;not null;default:''"`
	SubstitutionPrepID    string `gorm:"column:substitution_prep_id;size:64;not null;default:''"`
	SubstitutionSubject   string `gorm:"size:255;not null;default:''"`
	SubstitutionSubjType  string `gorm:"size:64;not null;default:''"`
	SubstitutionSubjCafID string `gorm:"column:substitution_subj_caf_id;size:64;not null;default:''"`
	SubstitutionThemas    string `gorm:"type:text;not null;default:''"`

	AuthorUUID *string `gorm:"type:uuid"`
	BatchID    *string `gorm:"type:uuid"`
	BatchRow   *uint32
	CreatedAt  time.Time `gorm:"not null;index:idx_schedulecollect_created_id,priority:1,sort:desc"`
}

func (ScheduleCollect) TableName() string { return "schedule_collect_entries" }

type ScheduleCollectBatch struct {
	ID          string `gorm:"column:id;type:uuid;primaryKey"`
	AuthorUUID  string `gorm:"type:uuid"`
	PayloadHash string
}

func (ScheduleCollectBatch) TableName() string { return "schedule_collect_batches" }

var ErrScheduleCollectBatchConflict = errors.New("идентификатор пакета уже использован")

// NewScheduleCollect validates a submitted row and builds its stored form.
// The id is assigned by the service.
func NewScheduleCollect(e *entity.ScheduleCollectEntry) (*ScheduleCollect, error) {
	if err := ScheduleCollectValidate(e); err != nil {
		return nil, err
	}

	return &ScheduleCollect{
		GroupName:    e.GetGroup(),
		StudInLesson: e.GetStudInLesson(),
		Day:          e.GetDay(),
		Les:          e.GetLes(),
		Aud:          e.GetAud(),
		Week:         e.GetWeek(),
		Subg:         e.GetSubg(),
		Name:         e.GetName(),
		CafID:        e.GetCafId(),
		Subject:      e.GetSubject(),
		SubjType:     e.GetSubjType(),
		Date:         e.GetDate(),
		SubjCafID:    e.GetSubjCafId(),
		PrepID:       e.GetPrepId(),
		Themas:       e.GetThemas(),

		SubstitutionName:      e.GetSubstitutionName(),
		SubstitutionPrepID:    e.GetSubstitutionPrepId(),
		SubstitutionSubject:   e.GetSubstitutionSubject(),
		SubstitutionSubjType:  e.GetSubstitutionSubjType(),
		SubstitutionSubjCafID: e.GetSubstitutionSubjCafId(),
		SubstitutionThemas:    e.GetSubstitutionThemas(),

		CreatedAt: time.Now(),
	}, nil
}

func (s *ScheduleCollect) NormalizeBatchText() error {
	for _, field := range []struct {
		value *string
		name  string
		max   int
	}{
		{&s.GroupName, "группа", 255},
		{&s.Aud, "аудитория", 255},
		{&s.Name, "должность и ФИО преподавателя", 255},
		{&s.CafID, "код кафедры", 64},
		{&s.Subject, "дисциплина", 255},
		{&s.SubjType, "вид занятия", 64},
		{&s.SubjCafID, "код кафедры дисциплины", 64},
		{&s.PrepID, "код преподавателя", 64},
		{&s.Themas, "темы занятия", 0},
		{&s.SubstitutionName, "должность и ФИО заменяющего преподавателя", 255},
		{&s.SubstitutionPrepID, "код заменяющего преподавателя", 64},
		{&s.SubstitutionSubject, "дисциплина замены", 255},
		{&s.SubstitutionSubjType, "вид занятия замены", 64},
		{&s.SubstitutionSubjCafID, "код кафедры дисциплины замены", 64},
		{&s.SubstitutionThemas, "темы занятия замены", 0},
	} {
		text := strings.TrimSpace(*field.value)
		if strings.ContainsRune(text, 0) {
			return scheduleCollectInvalid("поле «%s» содержит недопустимый символ", field.name)
		}
		if field.max > 0 && utf8.RuneCountInString(text) > field.max {
			return scheduleCollectInvalid("поле «%s» должно содержать не более %d символов", field.name, field.max)
		}
		*field.value = text
	}
	return nil
}

func (s *ScheduleCollect) ToProto() *entity.ScheduleCollectEntry {
	entry := &entity.ScheduleCollectEntry{
		Id: s.ID,

		Group:        s.GroupName,
		StudInLesson: s.StudInLesson,
		Day:          s.Day,
		Les:          s.Les,
		Aud:          s.Aud,
		Week:         s.Week,
		Subg:         s.Subg,
		Name:         s.Name,
		CafId:        s.CafID,
		Subject:      s.Subject,
		SubjType:     s.SubjType,
		Date:         s.Date,
		SubjCafId:    s.SubjCafID,
		PrepId:       s.PrepID,
		Themas:       s.Themas,

		SubstitutionName:      s.SubstitutionName,
		SubstitutionPrepId:    s.SubstitutionPrepID,
		SubstitutionSubject:   s.SubstitutionSubject,
		SubstitutionSubjType:  s.SubstitutionSubjType,
		SubstitutionSubjCafId: s.SubstitutionSubjCafID,
		SubstitutionThemas:    s.SubstitutionThemas,

		CreatedAt: timestamppb.New(s.CreatedAt),
	}
	if s.AuthorUUID != nil {
		entry.AuthorUuid = *s.AuthorUUID
	}
	if s.BatchID != nil {
		entry.BatchId = *s.BatchID
		entry.BatchRow = *s.BatchRow
	}
	return entry
}

// ScheduleCollectValidate checks one row against the exchange format's
// required columns. It returns the first problem found, worded for the person
// filling the form in.
//
// Group is collected by the current form and may be absent in older submissions.
// StudInLesson, Week, Subg, PrepID, CafID, Subj_CafID and the matching
// Substitution_PrepID/Substitution_Subj_CafID columns exist in the exchange
// format but aren't asked of the teacher on the collector page — they're
// filled in later, downstream — so they're accepted whatever they are
// (usually empty/zero) rather than required here.
func ScheduleCollectValidate(e *entity.ScheduleCollectEntry) error {
	if e == nil {
		return scheduleCollectInvalid("запись не передана")
	}
	if e.GetStudInLesson() < 0 {
		return scheduleCollectInvalid("количество студентов не может быть отрицательным")
	}
	if e.GetDay() < 1 || e.GetDay() > 7 {
		return scheduleCollectInvalid("день недели должен быть от 1 до 7")
	}
	if e.GetLes() < 1 {
		return scheduleCollectInvalid("номер занятия должен быть не меньше 1")
	}
	if strings.TrimSpace(e.GetAud()) == "" {
		return scheduleCollectInvalid("укажите аудиторию")
	}
	if e.GetWeek() < 0 {
		return scheduleCollectInvalid("номер учебной недели не может быть отрицательным")
	}
	if e.GetSubg() < 0 {
		return scheduleCollectInvalid("номер подгруппы не может быть отрицательным")
	}
	if strings.TrimSpace(e.GetName()) == "" {
		return scheduleCollectInvalid("укажите должность и ФИО преподавателя")
	}
	if strings.TrimSpace(e.GetSubject()) == "" {
		return scheduleCollectInvalid("укажите наименование дисциплины")
	}
	if strings.TrimSpace(e.GetSubjType()) == "" {
		return scheduleCollectInvalid("укажите вид занятия")
	}
	if _, err := scheduleParseDate(e.GetDate()); err != nil {
		return scheduleCollectInvalid("дата занятия: %v", err)
	}

	// The substitution columns describe one event together: either none of
	// them are filled in, or at least who is substituting and what they teach.
	hasSubstitution := strings.TrimSpace(e.GetSubstitutionName()) != "" ||
		strings.TrimSpace(e.GetSubstitutionSubject()) != "" ||
		strings.TrimSpace(e.GetSubstitutionSubjType()) != "" ||
		strings.TrimSpace(e.GetSubstitutionThemas()) != ""
	if hasSubstitution {
		if strings.TrimSpace(e.GetSubstitutionName()) == "" {
			return scheduleCollectInvalid("замена: укажите должность и ФИО заменяющего преподавателя")
		}
		if strings.TrimSpace(e.GetSubstitutionSubject()) == "" {
			return scheduleCollectInvalid("замена: укажите наименование дисциплины")
		}
		if strings.TrimSpace(e.GetSubstitutionSubjType()) == "" {
			return scheduleCollectInvalid("замена: укажите вид занятия")
		}
	}

	return nil
}

func scheduleCollectInvalid(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrScheduleCollectInvalid, fmt.Sprintf(format, args...))
}
