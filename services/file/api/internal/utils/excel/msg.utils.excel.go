package excel

import "errors"

var (
	ErrOpenExcelFile      = errors.New("failed to open excel file")
	ErrReadSheet          = errors.New("failed to read sheet")
	ErrParseExcelUsers    = errors.New("failed to parse users from excel file")
	ErrParseExcelStudents = errors.New("failed to parse students from excel file")

	ErrStudentHeaderNotFound  = errors.New("не удалось найти строку заголовков в таблице — проверьте, что это выгрузка списка студентов из системы")
	ErrStudentRequiredColumns = errors.New("в таблице не найдены обязательная колонка «Фамилия, Имя, Отчество» — проверьте, что это выгрузка списка студентов")
	ErrStudentNoRows          = errors.New("в таблице не найдено ни одной строки студента с заполненным ФИО")
)
