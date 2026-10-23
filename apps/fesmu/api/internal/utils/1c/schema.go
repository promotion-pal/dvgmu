package onec

import (
	"fmt"
	"regexp"
)

// Карта базы: номера таблиц и полей конкретной конфигурации 1С.
// Номера генерируются 1С и различаются между конфигурациями (1c-reference.md,
// раздел 3), поэтому бизнес-методы берут их отсюда, а не хардкодят.
// Новая конфигурация (bgu старой редакции, зарплатные базы) = новая переменная
// Schema, запросы в репозиториях не трогаются.

// Schema — имена таблиц/полей одной конфигурации.
type Schema struct {
	Name     string
	Accounts string // план счетов (_AccNNN)

	// Итоги регистра бухгалтерии с аналитикой (_AccRgATNNN).
	AccTotals AccTotalsSchema
	// Движения регистра бухгалтерии (_AccRgNNN) и их субконто (_AccRgEDNNN):
	// какие документы и когда делали проводки.
	AccMoves    string
	AccMovesExt string

	Kontragents string // справочник контрагентов (_ReferenceNNN)
	// Колонка ИНН в справочнике контрагентов (_FldNNN). Пусто — не найдена,
	// тип контрагента определяется по названию (см. kind.go).
	KontragentINN string
	Contracts     string // справочник договоров
	KOSGU         string // справочник КОСГУ

	// График оплаты договоров обучения.
	Schedule ScheduleSchema
	// Квитанции на оплату, выставленные по договорам.
	Receipt ReceiptSchema
}

// ReceiptSchema — Документ.КвитанцияНаОплатуГосуслуг: выставленная квитанция
// с суммой, сроком и УИН для оплаты. Номера — из отчёта «Диагностика 1С».
type ReceiptSchema struct {
	Doc        string
	Contract   string // Договор
	Amount     string // СуммаДокумента
	ValidUntil string // СрокДействия
	UIN        string // УникальныйИдентификаторНачисления
	Purpose    string // НазначениеПлатежа
	Cancel     string // ПричинаАннулирования: заполнена — квитанция аннулирована
}

// ScheduleSchema — Документ.НачислениеДоходовБудущихПериодовОбразование:
// строки начислений по договорам и их порядок оплаты (график). Номера —
// из отчёта «Диагностика 1С» (карта метаданных). Поля заданы номером
// (_FldNNN); точное имя колонки SQL (_FldNNN, _FldNNNRRef, …) определяется
// по sys.columns, см. resolveSchedule.
type ScheduleSchema struct {
	Doc string // таблица документа

	Lines      string // ТЧ «Начисления»
	LineID     string // ИдентификаторСтроки
	Student    string // Студент
	Kontragent string // Контрагент
	Contract   string // Договор
	Sum        string // Сумма

	Pay         string // ТЧ «ПорядокОплаты»
	PayLineID   string // ИдентификаторСтроки — связь со строкой начислений
	PayUntil    string // ОплатитьДо
	PayAmount   string // СуммаПроцент
	PeriodStart string // НачалоПериода
	PeriodEnd   string // КонецПериода
}

// AccTotalsSchema — таблица итогов регистра бухгалтерии по субконто.
type AccTotalsSchema struct {
	Table        string
	Balance      string // остаток (сумма)
	TurnoverDt   string // оборот по дебету
	TurnoverCt   string // оборот по кредиту
	CurrentTotal string // служебный _Period «текущие итоги» (остаток на сейчас)
}

// SchemaBGU2 — БГУ ред.2: bgu2, bgu2025, bgu2017…bgu2024, test.
// Снято с bgu2025/bgu2 (1c-reference.md, раздел 6).
var SchemaBGU2 = Schema{
	Name:     "БГУ ред.2",
	Accounts: "_Acc54",
	AccTotals: AccTotalsSchema{
		Table:        "_AccRgAT341390",
		Balance:      "_Fld41355",
		TurnoverDt:   "_TurnoverDt41370",
		TurnoverCt:   "_TurnoverCt41371",
		CurrentTotal: "5999-11-01",
	},
	Schedule: ScheduleSchema{
		Doc:         "_Document683",
		Lines:       "_Document683_VT10829",
		LineID:      "_Fld10831",
		Student:     "_Fld10832",
		Kontragent:  "_Fld10833",
		Contract:    "_Fld10834",
		Sum:         "_Fld10838",
		Pay:         "_Document683_VT10846",
		PayLineID:   "_Fld10848",
		PayUntil:    "_Fld10849",
		PayAmount:   "_Fld10850",
		PeriodStart: "_Fld10851",
		PeriodEnd:   "_Fld10852",
	},
	Receipt: ReceiptSchema{
		Doc:        "_Document657",
		Contract:   "_Fld9447",
		Amount:     "_Fld9444",
		ValidUntil: "_Fld9442",
		UIN:        "_Fld9446",
		Purpose:    "_Fld9425",
		Cancel:     "_Fld9455",
	},
	AccMoves:    "_AccRg41346",
	AccMovesExt: "_AccRgED41392",
	Kontragents: "_Reference203",
	Contracts:   "_Reference129",
	KOSGU:       "_Reference227",
}

// SchemaFor выбирает карту по имени базы (список баз — 1c-reference.md, раздел 2).
// Для баз, чья карта ещё не снята (bgu старой ред., зарплатные), — ошибка,
// а не запрос по чужим номерам таблиц.
func SchemaFor(db string) (Schema, error) {
	switch {
	case db == "bgu2", db == "test", db == "бгу2022", reBGU2Year.MatchString(db):
		return SchemaBGU2, nil
	}
	return Schema{}, fmt.Errorf("1С: нет карты таблиц для базы %q", db)
}

var reBGU2Year = regexp.MustCompile(`^bgu20\d\d$`)
