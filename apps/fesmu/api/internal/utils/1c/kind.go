package onec

import (
	"regexp"
	"strings"
	"unicode"
)

// KontragentKind — физлицо или организация.
type KontragentKind int

const (
	KindPerson KontragentKind = iota + 1
	KindOrganization
)

// Маркеры организации в названии контрагента или договора. Работают, пока
// колонка ИНН не найдена (Schema.KontragentINN); по ИНН классификация точная.
var (
	orgAbbr = map[string]bool{
		"ООО": true, "ОАО": true, "ЗАО": true, "ПАО": true, "АО": true, "НАО": true,
		"ГБУ": true, "ГБУЗ": true, "КГБУ": true, "КГБУЗ": true, "ФГБУ": true, "ФГБОУ": true,
		"ГАУ": true, "ГАУЗ": true, "МБУ": true, "МАУ": true, "ГУП": true, "МУП": true,
		"ФГУП": true, "ФКУ": true, "НКО": true, "АНО": true, "ФБУЗ": true, "ФГКУ": true,
	}
	orgWords = []string{
		"министерств", "департамент", "управлени", "администраци", "учреждени",
		"общество", "фонд", "больниц", "поликлиник", "центр", "банк", "университет",
		"институт", "академи", "комитет", "агентств", "служб", "компани", "корпораци",
	}
)

var reFIO = regexp.MustCompile(`^[А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)?(\s+[А-ЯЁ][а-яё]+){1,3}$|^[А-ЯЁ][а-яё]+(-[А-ЯЁ][а-яё]+)?\s+[А-ЯЁ]\.\s*([А-ЯЁ]\.?)?$`)

// classify: по ИНН (10 цифр — организация, 12 — физлицо, включая ИП), иначе
// по названию.
func classify(inn, kontragent, contract string) KontragentKind {
	switch len(strings.TrimSpace(inn)) {
	case 10:
		return KindOrganization
	case 12:
		return KindPerson
	}

	if strings.HasPrefix(strings.TrimSpace(contract), "Соглашение") {
		return KindOrganization
	}
	if strings.ContainsAny(kontragent, `"«»`) {
		return KindOrganization
	}
	for _, w := range strings.FieldsFunc(kontragent, func(r rune) bool { return !unicode.IsLetter(r) }) {
		if orgAbbr[w] {
			return KindOrganization
		}
	}
	// «Фамилия Имя Отчество» / «Фамилия И.О.» — физлицо, даже если фамилия
	// похожа на слово-маркер («Центров», «Банков»).
	if reFIO.MatchString(strings.TrimSpace(kontragent)) {
		return KindPerson
	}
	lower := strings.ToLower(kontragent)
	for _, w := range orgWords {
		if strings.Contains(lower, w) {
			return KindOrganization
		}
	}
	return KindPerson
}
