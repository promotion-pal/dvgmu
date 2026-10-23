package models

import (
	"dvgmu/api/contract/gen/go/entity"
	"dvgmu/api/contract/gen/go/enum"
	"errors"
	"fmt"
	"strings"
	"time"

	"google.golang.org/protobuf/types/known/timestamppb"
)

type Student struct {
	ID     int64 `gorm:"primaryKey;autoIncrement"`
	UserID int64 `gorm:"not null;index;uniqueIndex:idx_students_user_group_record_book"`

	Group      string `gorm:"size:255;uniqueIndex:idx_students_user_group_record_book"`
	RecordBook string `gorm:"size:255;uniqueIndex:idx_students_user_group_record_book"`

	Status        enum.UserStudentStatus        `gorm:"not null"`
	EducationForm enum.UserStudentEducationForm `gorm:"not null"`

	NeedsDormitory bool `gorm:"not null;default:false"`

	User User `gorm:"foreignKey:UserID"`

	CreatedAt time.Time
	UpdatedAt time.Time
}

func (s *Student) ToProto() *entity.Student {
	return &entity.Student{
		Id:             s.ID,
		UserId:         s.UserID,
		Group:          s.Group,
		RecordBook:     s.RecordBook,
		Status:         s.Status,
		EducationForm:  s.EducationForm,
		NeedsDormitory: s.NeedsDormitory,
		CreatedAt:      timestamppb.New(s.CreatedAt),
		UpdatedAt:      timestamppb.New(s.UpdatedAt),
	}
}

type StudentCreateParams struct {
	UserID int64

	Group      string
	RecordBook string

	Status        enum.UserStudentStatus
	EducationForm enum.UserStudentEducationForm

	NeedsDormitory bool
}

func NewStudent(params StudentCreateParams) (*Student, error) {
	if params.UserID == 0 {
		return nil, errors.New("user_id is required")
	}

	now := time.Now()
	return &Student{
		UserID:         params.UserID,
		Group:          params.Group,
		RecordBook:     params.RecordBook,
		Status:         params.Status,
		EducationForm:  params.EducationForm,
		NeedsDormitory: params.NeedsDormitory,
		CreatedAt:      now,
		UpdatedAt:      now,
	}, nil
}

// Ниже — производные от RecordBook/EducationForm значения (факультет, курс,
// декан и т.п.). Они намеренно не хранятся отдельными колонками: номер
// зачётки — источник истины, а отдельные поля рано или поздно разойдутся
// с ним при правках. Разбираем на лету.

// ParseRecordBookCode разбирает 7-значный номер зачётной книжки вида
// FFYYNNN, где FF — код факультета, YY — год поступления, NNN — порядковый
// номер.
func (s *Student) ParseRecordBookCode() (facultyCode, admissionYear int, err error) {
	digits := strings.TrimSpace(s.RecordBook)
	if len(digits) != 7 {
		return 0, 0, fmt.Errorf("неверный формат номера зачётки: должно быть 7 цифр, получено %d", len(digits))
	}
	for _, ch := range digits {
		if ch < '0' || ch > '9' {
			return 0, 0, fmt.Errorf("неверный формат номера зачётки: содержит не цифры")
		}
	}

	var num int
	if _, err := fmt.Sscanf(digits, "%d", &num); err != nil {
		return 0, 0, fmt.Errorf("не удалось разобрать номер зачётки: %w", err)
	}

	facultyCode = num / 100000
	yearCode := (num % 100000) / 1000
	admissionYear = 2000 + yearCode

	return facultyCode, admissionYear, nil
}

func (s *Student) ParseFaculty() (string, error) {
	facultyCode, _, err := s.ParseRecordBookCode()
	if err != nil {
		return "", err
	}

	switch facultyCode {
	case 10:
		return "Лечебный ф.", nil
	case 20:
		return "Педиатрический ф.", nil
	case 30:
		return "Стоматологический ф.", nil
	case 40:
		return "Фармацевтический ф.", nil
	case 71:
		return "МГФ", nil
	default:
		return "", fmt.Errorf("неизвестный код факультета: %d", facultyCode)
	}
}

func (s *Student) ParseFacultyAdjective() (string, error) {
	facultyCode, _, err := s.ParseRecordBookCode()
	if err != nil {
		return "", err
	}

	switch facultyCode {
	case 10:
		return "Лечебного", nil
	case 20:
		return "Педиатрического ф.", nil
	case 30:
		return "Стоматологического ф.", nil
	case 40:
		return "Фармацевтического ф.", nil
	case 71:
		return "МГФ", nil
	default:
		return "", fmt.Errorf("неизвестный код факультета: %d", facultyCode)
	}
}

func (s *Student) ParseEducationForm() (string, error) {
	switch s.EducationForm {
	case enum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_BUDGET:
		return "Бюджет", nil
	case enum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_TARGET:
		return "Целевое", nil
	case enum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_CONTRACT:
		return "Контракт", nil
	case enum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_SPECIAL_QUOTA:
		return "Специальная квота", nil
	default:
		return "", fmt.Errorf("неизвестная форма обучения: %d", s.EducationForm)
	}
}

func (s *Student) ParseDeanFaculty() (string, error) {
	facultyCode, _, err := s.ParseRecordBookCode()
	if err != nil {
		return "", err
	}

	switch facultyCode {
	case 10:
		return "Власюк И. В.", nil
	case 20:
		return "Каплиева О. В.", nil
	case 30:
		return "Юркевич А. В.", nil
	case 40:
		return "Слободенюк Е. В.", nil
	case 71:
		return "Витько Е. В.", nil
	default:
		return "", fmt.Errorf("неизвестный код факультета: %d", facultyCode)
	}
}

func (s *Student) ParseCourse() (int, error) {
	_, admissionYear, err := s.ParseRecordBookCode()
	if err != nil {
		return 0, err
	}

	course := time.Now().Year() - admissionYear + 1
	if course < 1 {
		course = 1
	}
	if course > 6 {
		course = 6
	}

	return course, nil
}
