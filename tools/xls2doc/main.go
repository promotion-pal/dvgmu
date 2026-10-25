package main

import (
	"encoding/xml"
	"fmt"
	"log"
	"log/slog"
	"regexp"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/widget"
	"github.com/nguyenthenguyen/docx"
	"github.com/xuri/excelize/v2"
)

func main() {
	a := app.NewWithID("ru.fesmu.xls2doc")
	w := a.NewWindow("Конвертер XLS в DOC")
	w.Resize(fyne.NewSize(900, 700))

	w.SetContent(container.NewVBox(
		widget.NewLabel("Запуск цепочки конвертации файлов..."),
		widget.NewLabel("Пожалуйста, выберите сначала Excel-файл, затем Word-шаблон."),
	))

	showExcelDialog(w)
	w.ShowAndRun()
}

func showExcelDialog(w fyne.Window) {
	dialog.ShowFileOpen(func(reader fyne.URIReadCloser, err error) {
		if err != nil || reader == nil {
			log.Fatal("Excel файл не выбран")
		}
		excelPath := reader.URI().Path()
		fmt.Printf("Excel выбран: %s\n", excelPath)
		showWordDialog(w, excelPath)
	}, w)
}

func showWordDialog(w fyne.Window, excelPath string) {
	dialog.ShowFileOpen(func(reader fyne.URIReadCloser, err error) {
		if err != nil || reader == nil {
			log.Fatal("Word файл не выбран")
		}
		wordPath := reader.URI().Path()
		fmt.Printf("Word выбран: %s\n", wordPath)
		processFiles(excelPath, wordPath)
		w.Close()
	}, w)
}

func processFiles(excelPath, wordPath string) {
	// Открываем Excel
	f, err := excelize.OpenFile(excelPath)
	if err != nil {
		log.Fatalf("Не удалось открыть Excel: %v", err)
	}
	defer f.Close()

	sheetName := f.GetSheetName(0)
	rows, err := f.GetRows(sheetName)
	if err != nil {
		slog.Error("failed to get rows", "sheet", sheetName, "error", err)
		return
	}

	headerRows := headerRowCount(f, sheetName)
	if len(rows) <= headerRows {
		log.Fatal("В таблице нет данных (только шапка или пусто)")
	}

	targetRow := rows[headerRows]

	readDocx, err := docx.ReadDocxFile(wordPath)
	if err != nil {
		log.Fatalf("Не удалось открыть Word: %v", err)
	}
	defer readDocx.Close()

	// Word часто разбивает плейсхолдер {{A}} на несколько XML-runов (например,
	// из-за автоопределения языка для латинских букв внутри русского текста),
	// поэтому простой strings.Replace по всему XML их не находит. Ищем
	// плейсхолдеры регулярным выражением, допускающим XML-теги между
	// значимыми символами, и заменяем весь найденный фрагмент одним run'ом.
	// Имена плейсхолдеров (A, C, AG, BN...) не заданы заранее, а берутся
	// прямо из шаблона — это буквенное обозначение колонки Excel.
	doc := readDocx.Editable()
	content := doc.GetContent()
	for _, name := range findPlaceholderNames(content) {
		value := getCellByColLetter(name, targetRow)
		content = replacePlaceholder(content, name, value)
	}
	doc.SetContent(content)

	// Сохраняем результат
	if err := doc.WriteToFile("./ready_report.docx"); err != nil {
		log.Fatalf("Ошибка сохранения Word: %v", err)
	}
	fmt.Println("🎉 Процесс успешно завершен! Файл ready_report.docx создан.")
}

var (
	xmlTagRe          = regexp.MustCompile(`<[^>]*>`)
	placeholderNameRe = regexp.MustCompile(`\{\{([A-Z]+)\}\}`)
	runPropsRe        = regexp.MustCompile(`<w:rPr>.*?</w:rPr>`)
)

// findPlaceholderNames возвращает имена всех плейсхолдеров {{XXX}}, реально
// присутствующих в шаблоне (буквенные обозначения колонок Excel: A, C, AG...).
// Поиск идёт по видимому тексту (теги вырезаны), поэтому находит и те
// плейсхолдеры, что физически разбиты Word'ом на несколько runов.
func findPlaceholderNames(content string) []string {
	visibleText := xmlTagRe.ReplaceAllString(content, "")
	matches := placeholderNameRe.FindAllStringSubmatch(visibleText, -1)

	seen := make(map[string]bool)
	var names []string
	for _, m := range matches {
		if !seen[m[1]] {
			seen[m[1]] = true
			names = append(names, m[1])
		}
	}
	return names
}

// replacePlaceholder ищет плейсхолдер вида {{XXX}} в сыром XML документа,
// допуская, что Word разбил его на несколько runов (в том числе внутри
// самого имени), и заменяет весь найденный фрагмент (вместе со служебными
// тегами) на новый run со значением, сохраняя форматирование (rPr) первого
// найденного run'а.
func replacePlaceholder(content, name, value string) string {
	re := regexp.MustCompile(placeholderPattern(name))

	return re.ReplaceAllStringFunc(content, func(match string) string {
		rPr := runPropsRe.FindString(match)
		return `<w:r>` + rPr + `<w:t xml:space="preserve">` + escapeXMLText(value) + `</w:t></w:r>`
	})
}

func placeholderPattern(name string) string {
	tagGap := `(?:<[^>]*>)*`
	var b strings.Builder
	b.WriteString(`\{` + tagGap + `\{`)
	for _, ch := range name {
		b.WriteString(tagGap + regexp.QuoteMeta(string(ch)))
	}
	b.WriteString(tagGap + `\}` + tagGap + `\}`)
	return b.String()
}

func escapeXMLText(s string) string {
	var b strings.Builder
	if err := xml.EscapeText(&b, []byte(s)); err != nil {
		return s
	}
	return b.String()
}

// headerRowCount определяет число строк заголовка по объединённым ячейкам,
// начинающимся в первой строке (например, "A1:A2" — заголовок колонки
// растянут по вертикали на 2 строки, значит и весь заголовок таблицы
// занимает минимум 2 строки, даже если для других колонок заголовок
// однострочный). Если объединений от первой строки нет — заголовок
// состоит из одной строки.
func headerRowCount(f *excelize.File, sheet string) int {
	merges, err := f.GetMergeCells(sheet)
	if err != nil {
		return 1
	}
	maxRow := 1
	for _, m := range merges {
		_, startRow, err1 := excelize.CellNameToCoordinates(m.GetStartAxis())
		_, endRow, err2 := excelize.CellNameToCoordinates(m.GetEndAxis())
		if err1 != nil || err2 != nil {
			continue
		}
		if startRow == 1 && endRow > maxRow {
			maxRow = endRow
		}
	}
	return maxRow
}

func getCellByColLetter(letter string, row []string) string {
	colNum, err := excelize.ColumnNameToNumber(letter)
	if err != nil {
		return ""
	}
	sliceIndex := colNum - 1
	if sliceIndex >= len(row) {
		return ""
	}
	return row[sliceIndex]
}
