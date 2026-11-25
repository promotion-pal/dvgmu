package excel

import (
	"fmt"
	"io"
	"log/slog"
	"strconv"
	"strings"
	"unicode"

	"github.com/xuri/excelize/v2"
)

type Parser struct {
	log *slog.Logger
}

func NewParser(log *slog.Logger) *Parser {
	return &Parser{log: log}
}

func (p *Parser) openExcelSheet(data io.Reader) (*excelize.File, string, [][]string, error) {
	f, err := excelize.OpenReader(data)
	if err != nil {
		p.log.Error("failed to open excel file", "error", err)
		return nil, "", nil, fmt.Errorf("%w: %w", ErrOpenExcelFile, err)
	}

	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		_ = f.Close()
		p.log.Error("failed to get rows from sheet", "sheet", sheetName, "error", err)
		return nil, "", nil, fmt.Errorf("%w %q: %w", ErrReadSheet, sheetName, err)
	}

	return f, sheetName, rows, nil
}

type SheetPreview struct {
	Name     string
	RowCount int
	Rows     [][]string
}

func (p *Parser) ParsePreview(data io.Reader, maxRows int) ([]SheetPreview, error) {
	f, err := excelize.OpenReader(data)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrOpenExcelFile, err)
	}
	defer f.Close()

	var sheets []SheetPreview
	for _, name := range f.GetSheetList() {
		rows, err := f.GetRows(name)
		if err != nil {
			return nil, fmt.Errorf("%w %q: %w", ErrReadSheet, name, err)
		}

		preview := rows
		if len(preview) > maxRows {
			preview = preview[:maxRows]
		}

		sheets = append(sheets, SheetPreview{
			Name:     name,
			RowCount: len(rows),
			Rows:     preview,
		})
	}

	return sheets, nil
}

func rawIDCellAt(f *excelize.File, sheet string, row []string, rowIndex, colIndex int) string {
	cell, err := excelize.CoordinatesToCellName(colIndex+1, rowIndex+1)
	if err != nil {
		return colAt(row, colIndex)
	}
	val, err := f.GetCellValue(sheet, cell, excelize.Options{RawCellValue: true})
	if err != nil {
		return colAt(row, colIndex)
	}
	return val
}

func dateCellAt(f *excelize.File, sheet string, row []string, rowIndex, colIndex int) string {
	fallback := colAt(row, colIndex)

	cell, err := excelize.CoordinatesToCellName(colIndex+1, rowIndex+1)
	if err != nil {
		return fallback
	}
	if cellType, err := f.GetCellType(sheet, cell); err != nil || (cellType != excelize.CellTypeNumber && cellType != excelize.CellTypeUnset) {
		return fallback
	}
	raw, err := f.GetCellValue(sheet, cell, excelize.Options{RawCellValue: true})
	if err != nil {
		return fallback
	}
	serial, err := strconv.ParseFloat(strings.TrimSpace(raw), 64)
	if err != nil || serial < 1 {
		return fallback
	}
	t, err := excelize.ExcelDateToTime(serial, false)
	if err != nil {
		return fallback
	}
	return t.Format("2006-01-02")
}

func splitFullName(fullName string) (lastName, firstName, patronymic string) {
	parts := strings.Fields(fullName)
	if len(parts) < 2 || len(parts) > 4 {
		return "", "", ""
	}
	for _, p := range parts {
		if !isCapitalizedWord(p) {
			return "", "", ""
		}
	}
	if len(parts) == 2 {
		return parts[0], parts[1], ""
	}
	return parts[0], parts[1], strings.Join(parts[2:], " ")
}

func isCapitalizedWord(s string) bool {
	for _, segment := range strings.Split(s, "-") {
		r := []rune(segment)
		if len(r) == 0 || !unicode.IsUpper(r[0]) {
			return false
		}
		var hasUpperAfterFirst, hasLower bool
		for _, c := range r[1:] {
			if unicode.IsUpper(c) {
				hasUpperAfterFirst = true
			}
			if unicode.IsLower(c) {
				hasLower = true
			}
		}
		if hasUpperAfterFirst && hasLower {
			return false
		}
	}
	return true
}
