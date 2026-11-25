package docx

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

func makeDocx(t *testing.T, body string, files ...string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	w, _ := zw.Create("word/document.xml")
	w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"` +
		` xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"` +
		` xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>` + body + `</w:body></w:document>`))
	for i := 0; i+1 < len(files); i += 2 {
		f, _ := zw.Create(files[i])
		f.Write([]byte(files[i+1]))
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func p(text string) string {
	return `<w:p><w:r><w:t xml:space="preserve">` + text + `</w:t></w:r></w:p>`
}

func TestParseTest(t *testing.T) {
	data := makeDocx(t,
		p("Токсичность – это:")+p("@способность вызывать")+`<w:p><w:r><w:t>растворимость </w:t></w:r><w:r><w:t>в крови</w:t></w:r></w:p>`+
			`<w:p/>`+
			`<w:p><w:r><w:drawing><w:p><w:r><w:t>подпись</w:t></w:r></w:p></w:drawing></w:r></w:p>`+
			p("Яд — это:")+p("@ токсикант")+p("@вещество")+p("ксенобиотик"),
	)

	got, err := ParseTest(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Questions) != 2 {
		t.Fatalf("expected 2 questions, got %+v", got.Questions)
	}
	q1, q2 := got.Questions[0], got.Questions[1]
	if q1.Text != "Токсичность – это:" || len(q1.Options) != 2 || !q1.Options[0].Correct || q1.Options[1].Text != "растворимость в крови" {
		t.Errorf("first question: %+v", q1)
	}
	if q2.Text != "Яд — это:" || q2.Options[0].Text != "токсикант" || !q2.Options[0].Correct || !q2.Options[1].Correct || q2.Options[2].Correct {
		t.Errorf("second question: %+v", q2)
	}
	warnings := strings.Join(got.Warnings, "\n")
	if !strings.Contains(warnings, "вопрос 2: изображение в формате, который не импортируется") {
		t.Errorf("expected an image warning, got %q", warnings)
	}
}

func TestParseTestRejects(t *testing.T) {
	if _, err := ParseTest([]byte("not a zip")); err != ErrNotDocx {
		t.Errorf("expected ErrNotDocx, got %v", err)
	}
	if _, err := ParseTest(makeDocx(t, `<w:p/>`)); err == nil {
		t.Error("expected an error for a file without questions")
	}
}

// A picture on its own line before a question, as in Т-14-15, comes with it:
// the file's bytes, its type and its size in Word.
func TestParseTestImage(t *testing.T) {
	picture := func(id string) string {
		return `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="4867275" cy="2209800"/><a:graphic><a:graphicData>` +
			`<a:blip r:embed="` + id + `"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
	}
	rels := `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
		`<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.jpeg"/>` +
		`<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.emf"/>` +
		`</Relationships>`
	data := makeDocx(t,
		picture("rId5")+p("Прибыл на сортировочный пост:")+p("@на площадку")+p("в изолятор")+
			`<w:p/>`+picture("rId6")+p("Показания прибора ДП-5В:")+p("@норма")+p("опасно")+
			`<w:p/>`+p("Без картинки:")+p("@да")+p("нет"),
		"word/_rels/document.xml.rels", rels,
		"word/media/image1.jpeg", "\xff\xd8\xff jpeg bytes",
		"word/media/image2.emf", "emf bytes",
	)

	got, err := ParseTest(data)
	if err != nil {
		t.Fatal(err)
	}
	img := got.Questions[0].Image
	if img == nil || img.Mime != "image/jpeg" || string(img.Data) != "\xff\xd8\xff jpeg bytes" || img.WidthEMU != 4867275 || img.HeightEMU != 2209800 {
		t.Fatalf("expected the jpeg with its size on question 1, got %+v", img)
	}
	if got.Questions[1].Image != nil || got.Questions[2].Image != nil {
		t.Error("an EMF picture is not taken, and a question without one gets none")
	}
	if warnings := strings.Join(got.Warnings, "\n"); !strings.Contains(warnings, "вопрос 2: изображение в формате, который не импортируется") || strings.Contains(warnings, "вопрос 1:") {
		t.Errorf("only the EMF picture should be warned about, got %q", warnings)
	}
}
