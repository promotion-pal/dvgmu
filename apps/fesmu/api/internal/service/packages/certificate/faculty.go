package certificate

import (
	"strconv"
	"strings"

	mdmenum "fesmu/contract/mdm/enum"
)

// Факультет — первые две цифры номера зачётки (FFYYNNN), то же правило, что
// в services/dormitory (User.ParseFaculty). 0 — не определён.
const (
	FacultyUnknown    int32 = 0
	FacultyMedical    int32 = 10 // лечебный
	FacultyPediatric  int32 = 20 // педиатрический
	FacultyDental     int32 = 30 // стоматологический
	FacultyPharmacy   int32 = 40 // фармации и биомедицины
	FacultyHumanities int32 = 71 // медико-гуманитарный
)

var facultyLabels = map[int32]string{
	FacultyMedical:    "Лечебный факультет",
	FacultyPediatric:  "Педиатрический факультет",
	FacultyDental:     "Стоматологический факультет",
	FacultyPharmacy:   "Факультет фармации и биомедицины",
	FacultyHumanities: "Медико-гуманитарный факультет",
}

// FacultyFromRecordBook — код факультета по зачётке; неизвестный код — 0.
func FacultyFromRecordBook(recordBook string) int32 {
	rb := strings.TrimSpace(recordBook)
	if len(rb) < 2 {
		return FacultyUnknown
	}
	code, err := strconv.Atoi(rb[:2])
	if err != nil {
		return FacultyUnknown
	}
	if _, ok := facultyLabels[int32(code)]; !ok {
		return FacultyUnknown
	}
	return int32(code)
}

// FacultyLabel — название для журнала и кабинета; "" — не определён.
func FacultyLabel(code int32) string { return facultyLabels[code] }

// deaneries — деканат (подразделение сотрудника в MDM) → его факультет.
var deaneries = map[mdmenum.UserEmployeeDepartment]int32{
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_LECHEBNOGO_FAKULTETA:               FacultyMedical,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_PEDIATRICHESKOGO_FAKULTETA:         FacultyPediatric,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_STOMATOLOGICHESKOGO_FAKULTETA:      FacultyDental,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_FAKULTETA_FARMATSII_I_BIOMEDITSINY: FacultyPharmacy,
	mdmenum.UserEmployeeDepartment_USER_EMPLOYEE_DEPARTMENT_DEKANAT_MEDIKO_GUMANITARNOGO_FAKULTETA:     FacultyHumanities,
}

// FacultiesOfDepartments — факультеты деканатов, в которых работает сотрудник.
func FacultiesOfDepartments(departments []mdmenum.UserEmployeeDepartment) map[int32]bool {
	out := map[int32]bool{}
	for _, d := range departments {
		if f, ok := deaneries[d]; ok {
			out[f] = true
		}
	}
	return out
}
