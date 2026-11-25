package models

import (
	"testing"
	"time"
)

func day(s string) *time.Time {
	t, _ := time.Parse("2006-01-02", s)
	return &t
}

func TestSamePersonAs(t *testing.T) {
	existing := &User{
		LastName: "Абдусатторова", FirstName: "Ширин", Patronymic: "Мизробшоевна",
		Birthday: day("2006-05-01"),
		Passport: &Passport{Series: "0821", Number: "778435"},
	}
	base := UserCreateBatchItemParams{LastName: "АБДУСАТТОРОВА", FirstName: "ширин", Patronymic: "Мизробшоевна"}

	cases := []struct {
		name string
		mod  func(i *UserCreateBatchItemParams)
		want bool
	}{
		{"те же данные, другой регистр", func(i *UserCreateBatchItemParams) {}, true},
		{"дата рождения совпадает", func(i *UserCreateBatchItemParams) { i.Birthday = day("2006-05-01") }, true},
		{"другая дата рождения", func(i *UserCreateBatchItemParams) { i.Birthday = day("2001-01-01") }, false},
		{"паспорт совпадает (с пробелом)", func(i *UserCreateBatchItemParams) {
			i.Passport = &PassportCreateParams{Series: "08 21", Number: "778435"}
		}, true},
		{"другой номер паспорта", func(i *UserCreateBatchItemParams) {
			i.Passport = &PassportCreateParams{Series: "0821", Number: "111111"}
		}, false},
		{"другое имя", func(i *UserCreateBatchItemParams) { i.FirstName = "Мария" }, false},
	}
	for _, c := range cases {
		item := base
		c.mod(&item)
		if got := existing.SamePersonAs(item); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}
