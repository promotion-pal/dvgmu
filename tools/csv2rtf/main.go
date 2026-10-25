package main

import (
	"bufio"
	"fmt"
	"log"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/dialog"
	"fyne.io/fyne/v2/storage"
	"fyne.io/fyne/v2/widget"
)

type test struct {
	id     string
	predID string
	descr  string
}

type question struct {
	no      int
	text    string
	answers []string
	correct []bool
}

func main() {
	a := app.NewWithID("ru.fesmu.xlst2rtf")
	w := a.NewWindow("Конвертер тестов CSV в RTF")
	w.Resize(fyne.NewSize(700, 300))

	w.SetContent(container.NewVBox(
		widget.NewLabel("Запуск цепочки конвертации тестов..."),
		widget.NewLabel("Выберите сначала файл с тестами (etest), затем файл с заданиями (etestzad)."),
	))

	showTestsDialog(w)
	w.ShowAndRun()
}

func showTestsDialog(w fyne.Window) {
	fd := dialog.NewFileOpen(func(reader fyne.URIReadCloser, err error) {
		if err != nil || reader == nil {
			log.Fatal("файл с тестами не выбран")
		}
		testsPath := reader.URI().Path()
		reader.Close()
		fmt.Printf("Файл тестов выбран: %s\n", testsPath)
		showZadDialog(w, testsPath)
	}, w)
	fd.SetFilter(storage.NewExtensionFileFilter([]string{".csv"}))
	fd.Show()
}

func showZadDialog(w fyne.Window, testsPath string) {
	fd := dialog.NewFileOpen(func(reader fyne.URIReadCloser, err error) {
		if err != nil || reader == nil {
			log.Fatal("файл с заданиями не выбран")
		}
		zadPath := reader.URI().Path()
		reader.Close()
		fmt.Printf("Файл заданий выбран: %s\n", zadPath)
		processFiles(w, testsPath, zadPath)
	}, w)
	fd.SetFilter(storage.NewExtensionFileFilter([]string{".csv"}))
	fd.Show()
}

func processFiles(w fyne.Window, testsPath, zadPath string) {
	tests, err := readTests(testsPath)
	if err != nil {
		dialog.ShowError(fmt.Errorf("не удалось прочитать файл тестов: %w", err), w)
		return
	}

	questionsByTest, err := readQuestions(zadPath)
	if err != nil {
		dialog.ShowError(fmt.Errorf("не удалось прочитать файл заданий: %w", err), w)
		return
	}

	uploadsDir := "uploads"
	if err := os.MkdirAll(uploadsDir, 0o755); err != nil {
		dialog.ShowError(fmt.Errorf("не удалось создать папку uploads: %w", err), w)
		return
	}

	knownTestIDs := make(map[string]bool, len(tests))
	for _, t := range tests {
		knownTestIDs[t.id] = true
	}
	skippedQuestions := 0
	for testID, questions := range questionsByTest {
		if !knownTestIDs[testID] {
			skippedQuestions += len(questions)
		}
	}

	subjectFolders := subjectFolderNames(tests)
	createdDirs := map[string]bool{}
	seenContent := map[string]bool{}

	written := 0
	emptyTests := 0
	duplicateTests := 0
	for _, t := range tests {
		questions := questionsByTest[t.id]
		if len(questions) == 0 {
			emptyTests++
			slog.Warn("тест без заданий, пропущен", "IDtest", t.id, "Descr", t.descr)
			continue
		}
		sort.Slice(questions, func(i, j int) bool { return questions[i].no < questions[j].no })

		var sig strings.Builder
		for _, q := range questions {
			sig.WriteString(questionSignature(q))
			sig.WriteByte('\x1e')
		}
		contentKey := t.predID + "\x00" + sig.String()
		if seenContent[contentKey] {
			duplicateTests++
			continue
		}
		seenContent[contentKey] = true

		subjectDir := filepath.Join(uploadsDir, sanitizeFileName(subjectFolders[t.predID]))
		if !createdDirs[subjectDir] {
			if err := os.MkdirAll(subjectDir, 0o755); err != nil {
				slog.Error("не удалось создать папку предмета", "dir", subjectDir, "error", err)
				continue
			}
			createdDirs[subjectDir] = true
		}

		name := fileName(subjectDir, t.descr)
		if err := os.WriteFile(name, []byte(buildRTF(t.descr, questions)), 0o644); err != nil {
			slog.Error("не удалось записать rtf", "file", name, "error", err)
			continue
		}
		written++
	}

	msg := fmt.Sprintf("Готово! Создано файлов: %d\nПропущено тестов без заданий: %d\nПропущено точных дублей: %d\nЗаданий с неизвестным TestID: %d",
		written, emptyTests, duplicateTests, skippedQuestions)
	fmt.Println(msg)
	dialog.ShowInformation("Конвертация завершена", msg, w)
}

func readTests(path string) ([]test, error) {
	rows, err := readCSV(path)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("пустой файл")
	}

	idx := columnIndex(rows[0])
	idCol, ok := idx["IDtest"]
	if !ok {
		return nil, fmt.Errorf("не найдена колонка IDtest")
	}
	predCol, ok := idx["PredID"]
	if !ok {
		return nil, fmt.Errorf("не найдена колонка PredID")
	}
	descrCol, ok := idx["Descr"]
	if !ok {
		return nil, fmt.Errorf("не найдена колонка Descr")
	}

	var tests []test
	for _, row := range rows[1:] {
		id := cell(row, idCol)
		if id == "" {
			continue
		}
		tests = append(tests, test{id: id, predID: cell(row, predCol), descr: cell(row, descrCol)})
	}
	return tests, nil
}

func subjectFolderNames(tests []test) map[string]string {
	descrsByPred := map[string][]string{}
	for _, t := range tests {
		descrsByPred[t.predID] = append(descrsByPred[t.predID], t.descr)
	}

	names := make(map[string]string, len(descrsByPred))
	for predID, descrs := range descrsByPred {
		counts := map[string]int{}
		for _, d := range descrs {
			if c := cleanSubjectName(d); c != "" {
				counts[c]++
			}
		}
		best := ""
		bestCount := 0
		for name, count := range counts {
			if count > bestCount || (count == bestCount && name < best) {
				best, bestCount = name, count
			}
		}
		if best == "" {
			best = strings.TrimSpace(descrs[0])
		}
		names[predID] = best
	}
	return names
}

var (
	subjectYearPrefixRe = regexp.MustCompile(`^\d{2}/\d{2}\s+`)
	subjectTrailNumRe   = regexp.MustCompile(`[\s_\-]*\d+\s*$`)
)

func cleanSubjectName(descr string) string {
	s := subjectYearPrefixRe.ReplaceAllString(strings.TrimSpace(descr), "")
	s = subjectTrailNumRe.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

func readQuestions(path string) (map[string][]question, error) {
	rows, err := readCSV(path)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("пустой файл")
	}

	idx := columnIndex(rows[0])
	required := []string{"TestID", "str0", "str1", "str2", "str3", "str4", "str5", "otv", "zadNo"}
	for _, col := range required {
		if _, ok := idx[col]; !ok {
			return nil, fmt.Errorf("не найдена колонка %s", col)
		}
	}

	result := map[string][]question{}
	for _, row := range rows[1:] {
		testID := cell(row, idx["TestID"])
		if testID == "" {
			continue
		}

		q := question{
			no:   atoiOr(cell(row, idx["zadNo"]), 0),
			text: cell(row, idx["str0"]),
		}
		rawAnswers := []string{
			cell(row, idx["str1"]),
			cell(row, idx["str2"]),
			cell(row, idx["str3"]),
			cell(row, idx["str4"]),
			cell(row, idx["str5"]),
		}
		otv := cell(row, idx["otv"])
		numOptions := 0
		for _, ans := range rawAnswers {
			if ans != "_" && ans != "" {
				numOptions++
			}
		}
		for i, ans := range rawAnswers {
			if ans == "_" || ans == "" {
				continue
			}
			isCorrect := false
			if pos := numOptions - 1 - i; pos >= 0 && pos < len(otv) {
				isCorrect = otv[pos] == '1'
			}
			q.answers = append(q.answers, ans)
			q.correct = append(q.correct, isCorrect)
		}

		result[testID] = append(result[testID], q)
	}

	return result, nil
}

func readCSV(path string) ([][]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)

	var rows [][]string
	var pending strings.Builder
	flush := func() {
		if pending.Len() > 0 {
			rows = append(rows, splitCSVLine(pending.String(), ';'))
			pending.Reset()
		}
	}

	first := true
	for sc.Scan() {
		line := strings.TrimSuffix(sc.Text(), "\r")
		if first {
			line = strings.TrimPrefix(line, "\uFEFF")
			first = false
		}
		if line == "" {
			continue
		}
		if pending.Len() > 0 && startsNewCSVRecord(line) {
			flush()
		}
		if pending.Len() > 0 {
			pending.WriteByte('\n')
		}
		pending.WriteString(line)
	}
	flush()
	if err := sc.Err(); err != nil {
		return nil, err
	}
	return rows, nil
}

var leadingIntFieldRe = regexp.MustCompile(`^\d+;`)

func startsNewCSVRecord(line string) bool {
	return leadingIntFieldRe.MatchString(line)
}

func splitCSVLine(line string, delim byte) []string {
	var fields []string
	i, n := 0, len(line)
	for {
		var field strings.Builder
		if i < n && line[i] == '"' {
			i++
			for i < n {
				if line[i] == '"' {
					if i+1 < n && line[i+1] == '"' {
						field.WriteByte('"')
						i += 2
						continue
					}
					i++
					break
				}
				field.WriteByte(line[i])
				i++
			}
			for i < n && line[i] != delim {
				field.WriteByte(line[i])
				i++
			}
		} else {
			start := i
			for i < n && line[i] != delim {
				i++
			}
			field.WriteString(line[start:i])
		}
		fields = append(fields, field.String())
		if i < n && line[i] == delim {
			i++
			if i == n {
				fields = append(fields, "")
				break
			}
			continue
		}
		break
	}
	return fields
}

func columnIndex(header []string) map[string]int {
	idx := make(map[string]int, len(header))
	for i, name := range header {
		idx[strings.TrimSpace(name)] = i
	}
	return idx
}

func cell(row []string, i int) string {
	if i < 0 || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

func atoiOr(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return def
	}
	return n
}

func questionSignature(q question) string {
	var b strings.Builder
	b.WriteString(q.text)
	for i, a := range q.answers {
		fmt.Fprintf(&b, "\x1f%s=%v", a, q.correct[i])
	}
	return b.String()
}

var fileNameSanitizeRe = regexp.MustCompile(`[\\/:*?"<>|]+`)

func sanitizeFileName(s string) string {
	base := fileNameSanitizeRe.ReplaceAllString(strings.TrimSpace(s), "_")
	base = strings.Trim(base, "_ ")
	if base == "" {
		base = "test"
	}
	return base
}

func fileName(dir, descr string) string {
	base := sanitizeFileName(descr)
	name := filepath.Join(dir, base+".rtf")
	for n := 2; fileExists(name); n++ {
		name = filepath.Join(dir, fmt.Sprintf("%s (%d).rtf", base, n))
	}
	return name
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func buildRTF(descr string, questions []question) string {
	var b strings.Builder
	b.WriteString(`{\rtf1\ansi\ansicpg1251\deff0\deflang1049`)
	b.WriteString(`{\fonttbl{\f0\froman\fcharset204 Times New Roman;}}`)
	b.WriteString("\n")
	b.WriteString(`\f0\fs20`)
	b.WriteString("\n")

	fmt.Fprintf(&b, "\\pard\\qc{\\b %s}\\par\n", rtfEscape("Тема: "+descr))
	b.WriteString("\\pard\\par\n")

	for i, q := range questions {
		fmt.Fprintf(&b, "\\pard\\qc{\\b %s}\\par\n", rtfEscape(fmt.Sprintf("Задание № %d", i+1)))
		fmt.Fprintf(&b, "\\pard\\qc %s\\par\n", rtfEscape(q.text))
		b.WriteString("\\pard\\par\n")
		fmt.Fprintf(&b, "\\pard %s\\par\n", rtfEscape("Ответ:"))
		for j, ans := range q.answers {
			label := fmt.Sprintf("%d.", j+1)
			if j < len(q.correct) && q.correct[j] {
				fmt.Fprintf(&b, "\\pard\\li600{\\b\\ul %s} %s\\par\n", label, rtfEscape(ans))
			} else {
				fmt.Fprintf(&b, "\\pard\\li600 %s %s\\par\n", label, rtfEscape(ans))
			}
		}
		b.WriteString("\\pard\\par\n")
	}

	b.WriteString("}")
	return b.String()
}

func rtfEscape(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r == '\\' || r == '{' || r == '}':
			b.WriteByte('\\')
			b.WriteRune(r)
		case r == '\n':
			b.WriteString(`\line `)
		case r >= 0x20 && r < 0x80:
			b.WriteRune(r)
		default:
			fmt.Fprintf(&b, `\u%d?`, int16(r))
		}
	}
	return b.String()
}
