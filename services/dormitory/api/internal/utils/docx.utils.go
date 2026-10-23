package utils

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"
)

//go:embed templates/template_duty.docx
var dutyTemplate []byte

// DutyEntry — одна заполненная строка графика: день месяца и данные дежурного.
type DutyEntry struct {
	Day          int
	FullName     string // «Иванов Иван Иванович»
	GroupFaculty string // «309, ЛЕЧ»
	Room         string // «305»
}

// DutyRosterData — данные для одного этажа за один месяц.
type DutyRosterData struct {
	Floor      int
	MonthLabel string // «Сентябрь 2026 года»
	Location   string // номер общежития, по умолчанию "2"
	Chairman   string // председатель студсовета, по умолчанию "Еремин. С. С."
	Entries    []DutyEntry
}

const (
	defaultLocation = "2"
	defaultChairman = "Еремин. С. С."
)

var ruMonthsNominative = [...]string{
	"", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
	"Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
}

// MonthLabel возвращает подпись месяца в формате шаблона: «Сентябрь 2026 года».
func MonthLabel(t time.Time) string {
	return fmt.Sprintf("%s %d года", ruMonthsNominative[t.Month()], t.Year())
}

// FloorFromRoom — этаж = номер комнаты без последних двух цифр
// (305 → 3, 203 → 2, 1014 → 10, 1104 → 11).
func FloorFromRoom(room int32) int {
	if room < 100 {
		return 0
	}
	return int(room / 100)
}

var (
	// строка таблицы (вложенных <w:tr> нет)
	reTableRow = regexp.MustCompile(`(?s)<w:tr\b[^>]*>.*?</w:tr>`)
	// текст первой ячейки строки (номер дня)
	reFirstCellText = regexp.MustCompile(`<w:t[^>]*>([^<]*)</w:t>`)
	// любой текстовый узел документа: <w:t ...>текст</w:t>
	reAnyText = regexp.MustCompile(`<w:t([^>]*)>([^<]*)</w:t>`)
	// {{имя}} в тексте, склеенном из всех текстовых узлов без учёта границ рёбер Word
	rePlaceholder = regexp.MustCompile(`\{\{(\w+)\}\}`)
)

const emptyCellMarker = "</w:pPr></w:p></w:tc>"

func dataRunXML(text string) string {
	return `</w:pPr><w:r><w:rPr>` +
		`<w:rFonts w:ascii="Times New Roman" w:eastAsia="Calibri" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>` +
		`<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>` +
		`<w:t xml:space="preserve">` + text + `</w:t></w:r></w:p></w:tc>`
}

var xmlEscaper = strings.NewReplacer(
	"&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;",
)

func escapeXML(s string) string { return xmlEscaper.Replace(s) }

// RenderDutyRoster заполняет встроенный шаблон template_duty.docx и возвращает
// готовый .docx в виде байтов.
func RenderDutyRoster(data DutyRosterData) ([]byte, error) {
	return FillDutyRoster(dutyTemplate, data)
}

// FillDutyRoster заполняет произвольный .docx-шаблон данными графика дежурств.
func FillDutyRoster(template []byte, data DutyRosterData) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(template), int64(len(template)))
	if err != nil {
		return nil, fmt.Errorf("docx: не удалось прочитать шаблон: %w", err)
	}

	var out bytes.Buffer
	zw := zip.NewWriter(&out)

	for _, file := range zr.File {
		rc, err := file.Open()
		if err != nil {
			return nil, fmt.Errorf("docx: открытие %s: %w", file.Name, err)
		}
		content, err := io.ReadAll(rc)
		_ = rc.Close()
		if err != nil {
			return nil, fmt.Errorf("docx: чтение %s: %w", file.Name, err)
		}

		if file.Name == "word/document.xml" {
			content = []byte(fillDocumentXML(string(content), data))
		}

		w, err := zw.CreateHeader(&zip.FileHeader{Name: file.Name, Method: file.Method})
		if err != nil {
			return nil, fmt.Errorf("docx: запись %s: %w", file.Name, err)
		}
		if _, err := w.Write(content); err != nil {
			return nil, fmt.Errorf("docx: запись %s: %w", file.Name, err)
		}
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("docx: финализация архива: %w", err)
	}
	return out.Bytes(), nil
}

func fillDocumentXML(xml string, data DutyRosterData) string {
	location := data.Location
	if location == "" {
		location = defaultLocation
	}
	chairman := data.Chairman
	if chairman == "" {
		chairman = defaultChairman
	}

	values := map[string]string{
		"nowDate":  data.MonthLabel,
		"location": location,
		"chairman": chairman,
	}
	if data.Floor > 0 {
		values["floor"] = strconv.Itoa(data.Floor)
	}
	xml = fillPlaceholders(xml, values)

	byDay := make(map[int]DutyEntry, len(data.Entries))
	for _, entry := range data.Entries {
		byDay[entry.Day] = entry
	}

	xml = reTableRow.ReplaceAllStringFunc(xml, func(row string) string {
		cell := reFirstCellText.FindStringSubmatch(row)
		if cell == nil {
			return row
		}
		day, err := strconv.Atoi(strings.TrimSpace(cell[1]))
		if err != nil {
			return row
		}
		entry, ok := byDay[day]
		if !ok {
			return row
		}
		return fillRow(row, entry)
	})

	return xml
}

// fillPlaceholders заменяет {{name}} в тексте документа значениями из values.
// Word произвольно режет текст на несколько <w:t> в разных <w:r> (в т.ч. может
// разбить саму пару фигурных скобок "{{" на два разных рана), поэтому поиск
// плейсхолдеров идёт по тексту, склеенному из всех <w:t> без учёта границ
// рёбер, а результат затем аккуратно проецируется обратно на исходный XML:
// форматирование (rPr) берётся от рана, где плейсхолдер начинается, все раны
// внутри плейсхолдера выбрасываются целиком.
func fillPlaceholders(xml string, values map[string]string) string {
	matches := reAnyText.FindAllStringSubmatchIndex(xml, -1)
	if len(matches) == 0 {
		return xml
	}

	// textStart[i] — позиция начала текста i-го рана в склеенном plain-тексте;
	// contentStart[i] — позиция этого текста в исходном xml.
	var plain strings.Builder
	textStart := make([]int, len(matches))
	contentStart := make([]int, len(matches))
	for i, m := range matches {
		textStart[i] = plain.Len()
		contentStart[i] = m[4]
		plain.WriteString(xml[m[4]:m[5]])
	}
	plainText := plain.String()

	// runAt находит индекс рана, которому принадлежит позиция pos в plain-тексте.
	runAt := func(pos int) (idx int, offset int) {
		for i := len(matches) - 1; i >= 0; i-- {
			if textStart[i] <= pos {
				return i, pos - textStart[i]
			}
		}
		return 0, 0
	}

	var out strings.Builder
	lastXMLPos := 0
	for _, ph := range rePlaceholder.FindAllStringSubmatchIndex(plainText, -1) {
		name := plainText[ph[2]:ph[3]]
		value, ok := values[name]
		if !ok {
			continue
		}

		start, end := ph[0], ph[1] // границы "{{name}}" в plain-тексте
		i0, o0 := runAt(start)
		i1, o1 := runAt(end - 1)

		out.WriteString(xml[lastXMLPos : contentStart[i0]+o0])
		out.WriteString(escapeXML(value))
		lastXMLPos = contentStart[i1] + o1 + 1
	}
	out.WriteString(xml[lastXMLPos:])

	return out.String()
}

// fillRow вписывает ФИО / группу+факультет / комнату в три пустые ячейки строки.
func fillRow(row string, entry DutyEntry) string {
	values := [...]string{
		escapeXML(entry.FullName),
		escapeXML(entry.GroupFaculty),
		escapeXML(entry.Room),
	}

	pos := 0
	for _, value := range values {
		idx := strings.Index(row[pos:], emptyCellMarker)
		if idx < 0 {
			break
		}
		idx += pos
		replacement := dataRunXML(value)
		row = row[:idx] + replacement + row[idx+len(emptyCellMarker):]
		pos = idx + len(replacement)
	}
	return row
}
