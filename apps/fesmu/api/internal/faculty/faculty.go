// Package faculty — факультет студента (по зачётке), курс (по группе) и
// деканат сотрудника (по подразделению в MDM). Общие правила для справок и
// раздела «Деканат».
package faculty

import (
	"strconv"
	"strings"

	mdmenum "fesmu/contract/mdm/enum"
)

// Факультет — первые две цифры номера зачётки (FFYYNNN), то же правило, что
// в services/dormitory (User.ParseFaculty). 0 — не определён.
const (
	Unknown    int32 = 0
	Medical    int32 = 10 // лечебный
	Pediatric  int32 = 20 // педиатрический
	Dental     int32 = 30 // стоматологический
	Pharmacy   int32 = 40 // фармации и биомедицины
	Humanities int32 = 71 // медико-гуманитарный
)

var facultyLabels = map[int32]string{
	Medical:    "Лечебный факультет",
	Pediatric:  "Педиатрический факультет",
	Dental:     "Стоматологический факультет",
	Pharmacy:   "Факультет фармации и биомедицины",
	Humanities: "Медико-гуманитарный факультет",
}

// FromRecordBook — код факультета по зачётке; неизвестный код — 0.
func FromRecordBook(recordBook string) int32 {
	rb := strings.TrimSpace(recordBook)
	if len(rb) < 2 {
		return Unknown
	}
	code, err := strconv.Atoi(rb[:2])
	if err != nil {
		return Unknown
	}
	if _, ok := facultyLabels[int32(code)]; !ok {
		return Unknown
	}
	return int32(code)
}

// All — коды факультетов по порядку (для списков и подписей).
var All = []int32{Medical, Pediatric, Dental, Pharmacy, Humanities}

// Label — название для журнала и кабинета; "" — не определён.
func Label(code int32) string { return facultyLabels[code] }

// deaneries — деканат (подразделение сотрудника в MDM) → его факультет.
var deaneries = map[mdmenum.UserEmployeeDepartment]int32{
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_LECHEBNOGO_FAKULTETA:               Medical,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_PEDIATRICHESKOGO_FAKULTETA:         Pediatric,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_STOMATOLOGICHESKOGO_FAKULTETA:      Dental,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_FAKULTETA_FARMATSII_I_BIOMEDITSINY: Pharmacy,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_MEDIKO_GUMANITARNOGO_FAKULTETA:     Humanities,
}

// OfDepartments — факультеты деканатов, в которых работает сотрудник.
func OfDepartments(departments []mdmenum.UserEmployeeDepartment) map[int32]bool {
	out := map[int32]bool{}
	for _, d := range departments {
		if f, ok := deaneries[d]; ok {
			out[f] = true
		}
	}
	return out
}

// Course — курс по группе: первая цифра номера группы (309 → 3), то же
// правило, что в services/dormitory (User.ParseCourse). 0 — не определён.
func Course(group string) int32 {
	g := strings.TrimSpace(group)
	if g == "" || g[0] < '1' || g[0] > '9' {
		return 0
	}
	return int32(g[0] - '0')
}
