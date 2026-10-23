package rtf

import (
	"strings"
	"testing"
)

func TestTestDocument(t *testing.T) {
	doc := string(TestDocument(Test{
		Topic: "Химия {1}",
		Questions: []Question{{
			Text: "Металлическую\nрешетку имеет",
			Options: []Option{
				{Text: "железо", Correct: true},
				{Text: "водород"},
			},
		}},
	}))

	for _, want := range []string{
		text("Тема: Химия ") + `\{1\}\par`,
		`{\b ` + text("Задание № 1") + `}\par`,
		text("Металлическую решетку имеет") + `\par`,
		`{\b\ul 1.} ` + text("железо") + `\par`,
		pOption + `2. ` + text("водород") + `\par`,
	} {
		if !strings.Contains(doc, want) {
			t.Errorf("document has no %q", want)
		}
	}
	if !strings.HasPrefix(doc, `{\rtf1`) || !strings.HasSuffix(doc, "}\n") {
		t.Error("document is not a closed RTF group")
	}
}

// A question's picture goes between "Задание № N" and its text, as hex JPEG
// with its size in twips; a wide one is scaled to the page.
func TestTestDocumentImage(t *testing.T) {
	doc := string(TestDocument(Test{Topic: "Т-14-15", Questions: []Question{{
		Text:    "При данных показаниях прибора ИД-1",
		Options: []Option{{Text: "в изолятор", Correct: true}, {Text: "в строй"}},
		Image:   &Image{Data: []byte{0xff, 0xd8, 0xff, 0x00}, Width: 1000, Height: 500},
	}}}))

	task := strings.Index(doc, text("Задание № 1"))
	pict := strings.Index(doc, `{\*\shppict{\pict\jpegblip\picw1000\pich500\picwgoal9355\pichgoal4677`)
	question := strings.Index(doc, text("При данных показаниях прибора ИД-1"))
	if task < 0 || pict < task || question < pict {
		t.Fatalf("expected task, picture, question in that order: %d %d %d", task, pict, question)
	}
	if !strings.Contains(doc, "ffd8ff00}}") {
		t.Error("the picture's bytes must follow as hex")
	}
}

func TestFileName(t *testing.T) {
	if got := FileName(` Анатомия: кости/череп. `); got != "Анатомия_ кости_череп.rtf" {
		t.Errorf("got %q", got)
	}
	if got := FileName(" "); got != "test.rtf" {
		t.Errorf("got %q", got)
	}
}
