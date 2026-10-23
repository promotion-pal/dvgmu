package models

import (
	"strings"
	"time"
)

type UserCreateBatchItemParams struct {
	FirstName  string
	LastName   string
	Patronymic string
	Email      string
	Phone      *string
	Birthday   *time.Time

	Passport   *PassportCreateParams
	Educations []EducationCreateParams
	Military   *MilitaryCreateParams
}

type UserCreateBatchResult struct {
	Index             int
	Success           bool
	Message           string
	UserID            int64
	Email             string
	TemporaryPassword string
}

// SamePersonAs решает, относится ли строка импорта к уже существующему
// пользователю. ФИО совпадать может у разных людей, поэтому решают остальные
// данные: конфликт хотя бы по одному заполненному с обеих сторон полю (дата
// рождения, паспорт, СНИЛС, телефон) — это другой человек. Пустое с одной
// стороны конфликтом не считается — его как раз можно дозаполнить.
func (u *User) SamePersonAs(item UserCreateBatchItemParams) bool {
	if !equalFold(u.LastName, item.LastName) || !equalFold(u.FirstName, item.FirstName) {
		return false
	}
	if u.Patronymic != "" && item.Patronymic != "" && !equalFold(u.Patronymic, item.Patronymic) {
		return false
	}

	if u.Birthday != nil && item.Birthday != nil &&
		u.Birthday.UTC().Format("2006-01-02") != item.Birthday.UTC().Format("2006-01-02") {
		return false
	}

	if u.Phone != nil && item.Phone != nil {
		a, b := digitsTail(*u.Phone, 10), digitsTail(*item.Phone, 10)
		if a != "" && b != "" && a != b {
			return false
		}
	}

	if u.Passport != nil && item.Passport != nil {
		if conflictDigits(u.Passport.Series, item.Passport.Series) ||
			conflictDigits(u.Passport.Number, item.Passport.Number) ||
			conflictDigits(u.Passport.Snils, item.Passport.Snils) {
			return false
		}
	}

	return true
}

func equalFold(a, b string) bool {
	norm := func(s string) string {
		return strings.ReplaceAll(strings.ToLower(strings.TrimSpace(s)), "ё", "е")
	}
	return norm(a) == norm(b)
}

func onlyDigits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func digitsTail(s string, n int) string {
	d := onlyDigits(s)
	if len(d) > n {
		return d[len(d)-n:]
	}
	return d
}

func conflictDigits(a, b string) bool {
	da, db := onlyDigits(a), onlyDigits(b)
	return da != "" && db != "" && da != db
}
