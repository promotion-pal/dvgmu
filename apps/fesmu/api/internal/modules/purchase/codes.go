package purchase

import (
	"strings"
	"unicode"

	entity "fesmu/contract/fesmu/entity/v2"
)

var classifier = []struct {
	stems []string
	okpd2 string
	name  string
}{
	{[]string{"ноутбук", "планшет"}, "26.20.11.110", "Компьютеры портативные (ноутбуки, планшеты)"},
	{[]string{"компьютер", "пк", "моноблок", "системн"}, "26.20.15.000", "Машины вычислительные электронные цифровые прочие"},
	{[]string{"сервер"}, "26.20.14.000", "Машины вычислительные, поставляемые в виде систем"},
	{[]string{"монитор"}, "26.20.17.110", "Мониторы, подключаемые к компьютеру"},
	{[]string{"мфу", "многофункциональн"}, "26.20.18.000", "Устройства периферийные с двумя или более функциями"},
	{[]string{"принтер"}, "26.20.16.120", "Принтеры"},
	{[]string{"сканер", "клавиатур", "мыш", "манипулятор"}, "26.20.16", "Устройства ввода или вывода"},
	{[]string{"накопител", "ssd", "жестк", "флеш"}, "26.20.21", "Устройства запоминающие"},
	{[]string{"коммутатор", "маршрутизатор", "роутер", "свитч"}, "26.30.11.110", "Средства связи, выполняющие функцию систем коммутации"},
	{[]string{"телефон"}, "26.30.23", "Аппараты телефонные прочие"},
	{[]string{"картридж", "тонер"}, "28.23.25.000", "Части и принадлежности прочих офисных машин"},
	{[]string{"бумаг"}, "17.12.14.110", "Бумага для печати"},
	{[]string{"ручк", "карандаш", "канцеляр"}, "32.99.12", "Ручки и карандаши"},
	{[]string{"кресл", "стул"}, "31.01.11.150", "Мебель для сидения с металлическим каркасом"},
	{[]string{"стол", "шкаф", "тумб", "стеллаж", "мебел"}, "31.01.12", "Мебель деревянная для офисов"},
	{[]string{"кондиционер", "сплит"}, "28.25.12", "Системы кондиционирования воздуха"},
	{[]string{"лицензи", "программн", "антивирус"}, "58.29.50.000", "Услуги по предоставлению лицензий на право использовать программное обеспечение"},
	{[]string{"перчат"}, "22.19.60", "Перчатки резиновые"},
	{[]string{"шприц", "игл"}, "32.50.13", "Инструменты и приспособления медицинские (шприцы, иглы)"},
	{[]string{"реагент", "реактив"}, "20.59.52", "Реагенты сложные диагностические или лабораторные"},
	{[]string{"лекарств", "препарат", "медикамент"}, "21.20", "Препараты лекарственные"},
	{[]string{"микроскоп"}, "26.70.22", "Микроскопы"},
	{[]string{"халат", "спецодежд", "униформ"}, "14.12", "Спецодежда"},
	{[]string{"моющ", "чистящ", "дезинфиц"}, "20.41.32", "Средства моющие и чистящие"},
	{[]string{"светильник", "ламп"}, "27.40", "Оборудование электрическое осветительное"},
	{[]string{"учебник", "книг", "литератур"}, "58.11.1", "Книги печатные"},
	{[]string{"уборк", "клининг"}, "81.21.10", "Услуги по общей уборке зданий"},
	{[]string{"ремонт", "отделочн"}, "43.39", "Работы завершающие и отделочные в зданиях"},
	{[]string{"охран"}, "80.10.12", "Услуги охраны"},
	{[]string{"вывоз", "отход", "мусор"}, "38.11", "Отходы неопасные; услуги по сбору"},
	{[]string{"обучени", "курс", "квалификаци"}, "85.42.19", "Услуги по профессиональному обучению прочие"},
}

func suggestCodes(title string) *entity.PurchaseCodeSuggestion {
	okpd2, name := Classify(title)
	if okpd2 == "" {
		return &entity.PurchaseCodeSuggestion{}
	}
	return &entity.PurchaseCodeSuggestion{
		Found: true,
		Okpd2: okpd2,
		Ktru:  okpd2,
		Okved: OkvedOf(okpd2),
		Name:  name,
	}
}

// Classify guesses the ОКПД2 code of a purchase from its title, and the
// classifier's name for it; both empty when nothing matches. The first word
// that matches decides, by the longest stem.
func Classify(title string) (okpd2, name string) {
	words := strings.FieldsFunc(strings.ReplaceAll(strings.ToLower(title), "ё", "е"), func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsDigit(r)
	})

	best := -1
	for _, w := range words {
		bestLen := 0
		for i, entry := range classifier {
			for _, stem := range entry.stems {
				if strings.HasPrefix(w, stem) && len(stem) > bestLen {
					best, bestLen = i, len(stem)
				}
			}
		}
		if best >= 0 {
			break
		}
	}
	if best < 0 {
		return "", ""
	}
	return classifier[best].okpd2, classifier[best].name
}

// OkvedOf is the ОКВЭД2 class an ОКПД2 code falls under: its first two groups.
func OkvedOf(okpd2 string) string {
	parts := strings.Split(okpd2, ".")
	if len(parts) < 2 {
		return okpd2
	}
	return parts[0] + "." + parts[1]
}
