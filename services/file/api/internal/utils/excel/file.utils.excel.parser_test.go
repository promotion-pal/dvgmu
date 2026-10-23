package excel

import (
	"bytes"
	"log/slog"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

// TestFileExcelStudentParser_ISODatesAndOptionalEmail covers two real
// problems found importing a production student export: date cells came
// through GetRows as "03-07-05" (month first, two-digit year — unparseable
// for the caller), and every row without a personal email was dropped even
// though the email isn't needed to identify or create the student.
func TestFileExcelStudentParser_ISODatesAndOptionalEmail(t *testing.T) {
	f := excelize.NewFile()
	sheet := f.GetSheetName(0)

	for col, header := range []string{"ФИО", "Дата рождения", "Дата выдачи", "Пол", "Email"} {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		_ = f.SetCellValue(sheet, cell, header)
	}
	_ = f.SetCellValue(sheet, "A2", "ИВАНОВ ИВАН ИВАНОВИЧ")
	_ = f.SetCellValue(sheet, "B2", time.Date(2005, 3, 7, 0, 0, 0, 0, time.UTC))
	_ = f.SetCellValue(sheet, "C2", time.Date(2019, 3, 19, 0, 0, 0, 0, time.UTC))
	_ = f.SetCellValue(sheet, "D2", "Муж")
	// No email on this row.

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		t.Fatalf("write workbook: %v", err)
	}

	students, err := NewParser(slog.Default()).FileExcelStudentParser(&buf)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(students) != 1 {
		t.Fatalf("expected the row without an email to be kept, got %d students", len(students))
	}
	if got := students[0].Birthday; got != "2005-03-07" {
		t.Fatalf("expected ISO birthday 2005-03-07, got %q", got)
	}
	if got := students[0].PassportIssueDate; got != "2019-03-19" {
		t.Fatalf("expected ISO issue date 2019-03-19, got %q", got)
	}
}
