package excel

import "testing"

// TestSplitFullName_AllCaps guards against a real production bug: a student
// export where every row was "ФАМИЛИЯ ИМЯ ОТЧЕСТВО" in full caps (2837 of
// 3260 rows in one real file) got silently dropped entirely, since
// isCapitalizedWord only accepted Title Case.
func TestSplitFullName_AllCaps(t *testing.T) {
	last, first, patronymic := splitFullName("АБАДОНОВА АРИНА ДАНИЛОВНА")
	if last != "АБАДОНОВА" || first != "АРИНА" || patronymic != "ДАНИЛОВНА" {
		t.Fatalf("expected all-caps name to parse, got (%q, %q, %q)", last, first, patronymic)
	}
}

func TestSplitFullName_TitleCase(t *testing.T) {
	last, first, patronymic := splitFullName("Абакумова Алина Дмитриевна")
	if last != "Абакумова" || first != "Алина" || patronymic != "Дмитриевна" {
		t.Fatalf("expected title-case name to parse, got (%q, %q, %q)", last, first, patronymic)
	}
}

func TestSplitFullName_NoPatronymic(t *testing.T) {
	last, first, _ := splitFullName("Ван Зоя")
	if last != "Ван" || first != "Зоя" {
		t.Fatalf("expected 2-word name to parse, got (%q, %q)", last, first)
	}
}

func TestSplitFullName_HyphenatedAllCaps(t *testing.T) {
	last, first, _ := splitFullName("ВАН-ДИН-ИО ОЛЬГА")
	if last != "ВАН-ДИН-ИО" || first != "ОЛЬГА" {
		t.Fatalf("expected hyphenated all-caps name to parse, got (%q, %q)", last, first)
	}
}

// TestSplitFullName_RejectsGarbage makes sure the loosened check still does
// its actual job of skipping non-name rows (titles, filters, totals) and
// genuinely malformed input, not just letting everything through.
func TestSplitFullName_RejectsGarbage(t *testing.T) {
	cases := []string{
		"Список студентов групп",
		"ИвАнов Пётр",
		"1234 5678",
		"Иванов",
		"Иванов Петров Сидоров Кузнецов Смирнов",
	}
	for _, in := range cases {
		if last, first, _ := splitFullName(in); last != "" || first != "" {
			t.Fatalf("expected %q to be rejected, got (%q, %q)", in, last, first)
		}
	}
}
