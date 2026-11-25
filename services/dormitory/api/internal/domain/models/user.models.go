package models

import (
	"fmt"
	"strings"
	"time"
)

type User struct {
	ID         int64 `gorm:"primaryKey;autoIncrement"`
	Phone      string
	LastName   string
	FirstName  string
	Patronymic string
	RecordBook string
	Group      string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

func (User) TableName() string {
	return "users"
}

// ParseCourse определяет курс по номеру группы — первая цифра (309 → 3).
func (u *User) ParseCourse() (int, error) {
	for _, ch := range strings.TrimSpace(u.Group) {
		if ch >= '1' && ch <= '9' {
			return int(ch - '0'), nil
		}
	}
	return 0, fmt.Errorf("не удалось определить курс по группе %q", u.Group)
}

// ParseRecordBookCode разбирает 7-значный номер зачётной книжки вида FFYYNNN,
// где FF — код факультета, YY — год поступления, NNN — порядковый номер.
func (u *User) ParseRecordBookCode() (facultyCode, admissionYear int, err error) {
	digits := strings.TrimSpace(u.RecordBook)
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

func (u *User) ParseFaculty() (string, error) {
	facultyCode, _, err := u.ParseRecordBookCode()
	if err != nil {
		return "", err
	}

	switch facultyCode {
	case 10:
		return "ЛЕЧ", nil
	case 20:
		return "ПЕД", nil
	case 30:
		return "СТОМ", nil
	case 40:
		return "ФАРМ", nil
	case 71:
		return "МГФ", nil
	default:
		return "", fmt.Errorf("неизвестный код факультета: %d", facultyCode)
	}
}
