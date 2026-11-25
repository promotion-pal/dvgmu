// Package txt reads tests from the plain-text export of the testing system:
//
//  1. Текст вопроса:
//     #1. неверный вариант
//     @2. верный вариант
//
// A numbered line starts a question; "#N." marks an option, "@N." a correct
// one. The file is UTF-8 or, as the testing system saves it, Windows-1251.
package txt

import (
	"bytes"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"

	"dvgmu/api/internal/utils/docx"
)

var (
	questionLine = regexp.MustCompile(`^\d+\s*[.)]\s*(.*)$`)
	optionLine   = regexp.MustCompile(`^([#@])\s*\d*\s*[.)]?\s*(.*)$`)
)

// ParseTest reads the questions out of a .txt file.
func ParseTest(data []byte) (docx.Test, error) {
	text, err := decode(data)
	if err != nil {
		return docx.Test{}, err
	}

	var t docx.Test
	var cur *docx.Question
	flush := func() {
		if cur != nil {
			t.Questions = append(t.Questions, *cur)
			cur = nil
		}
	}
	for i, raw := range strings.Split(text, "\n") {
		line := strings.Join(strings.Fields(raw), " ")
		if line == "" {
			continue
		}
		if m := optionLine.FindStringSubmatch(line); m != nil {
			if cur == nil {
				t.Warnings = append(t.Warnings, fmt.Sprintf("строка %d: вариант ответа без вопроса пропущен", i+1))
				continue
			}
			cur.Options = append(cur.Options, docx.Option{Text: m[2], Correct: m[1] == "@"})
			continue
		}
		if m := questionLine.FindStringSubmatch(line); m != nil {
			flush()
			cur = &docx.Question{Text: m[1]}
			continue
		}
		// Neither: the previous line wrapped onto this one.
		switch {
		case cur == nil:
			t.Warnings = append(t.Warnings, fmt.Sprintf("строка %d: текст до первого вопроса пропущен", i+1))
		case len(cur.Options) == 0:
			cur.Text += " " + line
		default:
			last := &cur.Options[len(cur.Options)-1]
			last.Text += " " + line
		}
	}
	flush()

	if len(t.Questions) == 0 {
		return docx.Test{}, errors.New("в файле не найдено ни одного вопроса (вопрос — «1. Текст», варианты — «#1.» и «@2.» для верного)")
	}
	for i, q := range t.Questions {
		correct := 0
		for _, o := range q.Options {
			if o.Correct {
				correct++
			}
		}
		if len(q.Options) < 2 {
			t.Warnings = append(t.Warnings, fmt.Sprintf("вопрос %d: меньше двух вариантов ответа", i+1))
		}
		if correct == 0 {
			t.Warnings = append(t.Warnings, fmt.Sprintf("вопрос %d: не отмечен верный вариант («@»)", i+1))
		}
	}
	return t, nil
}

// decode returns the file as UTF-8 text with "\n" line ends.
func decode(data []byte) (string, error) {
	data = bytes.TrimPrefix(data, []byte("\xef\xbb\xbf"))
	if !utf8.Valid(data) {
		decoded, err := charmap.Windows1251.NewDecoder().Bytes(data)
		if err != nil {
			return "", fmt.Errorf("не удалось прочитать кодировку файла: %w", err)
		}
		data = decoded
	}
	return strings.NewReplacer("\r\n", "\n", "\r", "\n").Replace(string(data)), nil
}
