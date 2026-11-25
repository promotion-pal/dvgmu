package onec

import "testing"

func TestParseMetadata(t *testing.T) {
	const obj = "11111111-1111-1111-1111-111111111111"
	const inn = "22222222-2222-2222-2222-222222222222"
	const vt = "33333333-3333-3333-3333-333333333333"
	const reg = "44444444-4444-4444-4444-444444444444"
	text := "#dbnames\t1500\n" +
		obj + "\t" + obj + "\tReference\t203\tКонтрагенты\n" +
		obj + "\t" + inn + "\tFld\t4567\tИНН\n" +
		obj + "\t" + vt + "\tVT\t890\tКонтактнаяИнформация\r\n" +
		reg + "\t" + reg + "\tInfoRg\t555\tГрафикОплатыПоДоговорам\n" +
		"broken line\n" +
		"#files\t42\n#broken\t1\n#truncated\t3\n"

	md := parseMetadata([]byte(text))
	if md.DBNames != 1500 || md.Files != 42 || md.Broken != 1 || md.Truncated != 3 {
		t.Fatalf("stats: %+v", md)
	}
	if len(md.Objects) != 2 {
		t.Fatalf("objects: %d", len(md.Objects))
	}
	// Sorted by title: РегистрСведений… < Справочник…
	r, k := md.Objects[0], md.Objects[1]
	if r.Title() != "РегистрСведений.ГрафикОплатыПоДоговорам" || r.Table() != "_InfoRg555" {
		t.Fatalf("register: %s %s", r.Title(), r.Table())
	}
	if k.Title() != "Справочник.Контрагенты" || k.Table() != "_Reference203" || len(k.Attrs) != 2 {
		t.Fatalf("catalog: %s %s %+v", k.Title(), k.Table(), k.Attrs)
	}
	if c := k.Attrs[0].Column(k); k.Attrs[0].Name != "ИНН" || c != "_Fld4567" {
		t.Fatalf("inn: %s %s", k.Attrs[0].Name, c)
	}
	if c := k.Attrs[1].Column(k); c != "_Reference203_VT890" {
		t.Fatalf("vt: %s", c)
	}
}
