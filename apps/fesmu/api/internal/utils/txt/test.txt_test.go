package txt

import (
	"os"
	"strings"
	"testing"

	"golang.org/x/text/encoding/charmap"
)

const sample = "1. Деперсонализация — это:\r\n#1. усталость\r\n@2. отчуждение\r\nот себя\r\n#3. апатия\r\n\r\n" +
	"2. Выберите\r\nверные:\r\n@1. да\r\n#2. нет\r\n@3. тоже да\r\n\r\n" +
	"3. Без верного:\r\n#1. а\r\n#2. б\r\n"

func TestParseTestWindows1251(t *testing.T) {
	data, err := charmap.Windows1251.NewEncoder().Bytes([]byte(sample))
	if err != nil {
		t.Fatal(err)
	}
	got, err := ParseTest(data)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Questions) != 3 {
		t.Fatalf("expected 3 questions, got %d", len(got.Questions))
	}
	q := got.Questions[0]
	if q.Text != "Деперсонализация — это:" || len(q.Options) != 3 || !q.Options[1].Correct || q.Options[1].Text != "отчуждение от себя" {
		t.Errorf("unexpected first question %+v", q)
	}
	if got.Questions[1].Text != "Выберите верные:" || !got.Questions[1].Options[2].Correct {
		t.Errorf("expected a wrapped question with two correct options, got %+v", got.Questions[1])
	}
	if len(got.Warnings) != 1 || !strings.Contains(got.Warnings[0], "вопрос 3") {
		t.Errorf("expected one warning about question 3, got %v", got.Warnings)
	}
}

func TestParseTestUTF8(t *testing.T) {
	got, err := ParseTest([]byte("\xef\xbb\xbf" + strings.ReplaceAll(sample, "\r\n", "\n")))
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Questions) != 3 || got.Questions[0].Options[0].Text != "усталость" {
		t.Errorf("unexpected %+v", got.Questions)
	}
}

func TestParseTestEmpty(t *testing.T) {
	if _, err := ParseTest([]byte("просто текст\nбез вопросов")); err == nil {
		t.Error("expected an error for a file without questions")
	}
}

// TXT_SAMPLE=path go test ./internal/utils/txt -run Sample -v — a real export.
func TestParseTestSample(t *testing.T) {
	path := os.Getenv("TXT_SAMPLE")
	if path == "" {
		t.Skip("TXT_SAMPLE not set")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	got, err := ParseTest(data)
	if err != nil {
		t.Fatal(err)
	}
	for i, q := range got.Questions {
		t.Logf("%d. %s (%d вариантов)", i+1, q.Text, len(q.Options))
	}
	t.Logf("warnings: %v", got.Warnings)
}
