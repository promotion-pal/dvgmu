package models

import (
	"fesmu/contract/mdm/enum"
	"fmt"
	"testing"
	"time"
)

func TestStudentParseRecordBookCode(t *testing.T) {
	s := &Student{RecordBook: "1023001"}

	facultyCode, admissionYear, err := s.ParseRecordBookCode()
	if err != nil {
		t.Fatalf("ParseRecordBookCode: %v", err)
	}
	if facultyCode != 10 {
		t.Fatalf("unexpected faculty code: %d", facultyCode)
	}
	if admissionYear != 2023 {
		t.Fatalf("unexpected admission year: %d", admissionYear)
	}
}

func TestStudentParseRecordBookCode_InvalidFormat(t *testing.T) {
	s := &Student{RecordBook: "abc"}
	if _, _, err := s.ParseRecordBookCode(); err == nil {
		t.Fatal("expected error for malformed record book")
	}
}

func TestStudentParseFaculty(t *testing.T) {
	cases := map[string]string{
		"1023001": "Лечебный ф.",
		"2023001": "Педиатрический ф.",
		"3023001": "Стоматологический ф.",
		"4023001": "Фармацевтический ф.",
		"7123001": "МГФ",
	}
	for recordBook, want := range cases {
		s := &Student{RecordBook: recordBook}
		got, err := s.ParseFaculty()
		if err != nil {
			t.Fatalf("ParseFaculty(%s): %v", recordBook, err)
		}
		if got != want {
			t.Fatalf("ParseFaculty(%s) = %q, want %q", recordBook, got, want)
		}
	}
}

func TestStudentParseCourse(t *testing.T) {
	admissionYear := time.Now().Year() - 2
	s := &Student{RecordBook: recordBookFor(10, admissionYear)}

	course, err := s.ParseCourse()
	if err != nil {
		t.Fatalf("ParseCourse: %v", err)
	}
	if course != 3 {
		t.Fatalf("unexpected course: %d", course)
	}
}

func TestStudentParseEducationForm(t *testing.T) {
	s := &Student{EducationForm: enum.UserStudentEducationForm_USER_STUDENT_EDUCATION_FORM_BUDGET}
	got, err := s.ParseEducationForm()
	if err != nil {
		t.Fatalf("ParseEducationForm: %v", err)
	}
	if got != "Бюджет" {
		t.Fatalf("unexpected education form label: %s", got)
	}
}

// recordBookFor собирает тестовый номер зачётки вида FFYYNNN.
func recordBookFor(facultyCode, admissionYear int) string {
	yearCode := admissionYear - 2000
	num := facultyCode*100000 + yearCode*1000 + 1
	return fmt.Sprintf("%07d", num)
}
