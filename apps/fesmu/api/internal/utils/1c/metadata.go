package onec

// Карта метаданных: какой объект 1С (Справочник.Договоры, его реквизит ИНН,
// РегистрСведений.…) хранится в какой таблице/колонке SQL. Способ 2 из
// 1c-reference.md, раздел 5.
//
// Источники в базе 1С:
//   - Params, файл DBNames — соответствие «UUID объекта → вид и номер»
//     ({uuid,"Reference",129} → _Reference129, {uuid,"Fld",41355} → _Fld41355);
//   - Config, файлы с именем-UUID — описания объектов с русскими именами
//     самого объекта, его реквизитов и табличных частей.
//
// Оба хранятся сжатыми (raw deflate). Разбор идёт на хосте в PowerShell —
// конфигурация весит сотни мегабайт, по сети возвращаются только пары
// «UUID → имя», сжатые gzip.

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"sort"
	"strconv"
	"strings"
)

// MetaObject — объект конфигурации (справочник, документ, регистр…).
type MetaObject struct {
	UUID  string
	Kind  string // как в DBNames: Reference, Document, InfoRg, AccumRg, AccRg, Enum, Chrc, Acc
	Num   int
	Name  string
	Attrs []MetaAttr
}

// MetaAttr — реквизит (Fld) или табличная часть (VT) объекта.
type MetaAttr struct {
	Kind string // Fld или VT
	Num  int
	Name string
}

// Metadata — разобранная карта.
type Metadata struct {
	DBNames int // записей в DBNames
	Files   int // описаний объектов прочитано из Config
	Broken  int // описаний, которые не удалось распаковать
	// Сколько объектов выведено без реквизитов из-за предела строк.
	Truncated int
	Objects   []*MetaObject
}

// Table — имя таблицы объекта в SQL.
func (o *MetaObject) Table() string { return fmt.Sprintf("_%s%d", o.Kind, o.Num) }

// Title — имя объекта так, как его пишут в 1С: «Справочник.Договоры».
func (o *MetaObject) Title() string {
	if k, ok := metaKindTitle[o.Kind]; ok {
		return k + "." + o.Name
	}
	return o.Kind + "." + o.Name
}

// Column — колонка реквизита или таблица табличной части.
func (a MetaAttr) Column(o *MetaObject) string {
	if a.Kind == "VT" {
		return fmt.Sprintf("%s_VT%d", o.Table(), a.Num)
	}
	return fmt.Sprintf("_%s%d", a.Kind, a.Num)
}

var metaKindTitle = map[string]string{
	"Reference": "Справочник",
	"Document":  "Документ",
	"InfoRg":    "РегистрСведений",
	"AccumRg":   "РегистрНакопления",
	"AccRg":     "РегистрБухгалтерии",
	"Enum":      "Перечисление",
	"Chrc":      "ПланВидовХарактеристик",
	"Acc":       "ПланСчетов",
}

// ReadMetadata читает карту метаданных базы. Имена и таблицы — у всех
// объектов; реквизиты — у объектов, чьё имя подходит под keywords
// (регулярка .NET), и у справочников с номерами refs. На хосте занимает от
// десятков секунд до нескольких минут — для диагностики, не для каждого
// запроса страницы.
func (c *Client) ReadMetadata(ctx context.Context, keywords string, refs []int) (*Metadata, error) {
	nums := make([]string, len(refs))
	for i, n := range refs {
		nums[i] = "'" + strconv.Itoa(n) + "'"
	}
	vars := fmt.Sprintf("$kw=D('%s')\n$refs=@(%s)\n$maxLines=300000\n",
		b64(keywords), strings.Join(nums, ","))
	raw, err := c.run(ctx, psConnect(c.cfg), vars+metadataScript)
	if err != nil {
		return nil, err
	}
	zr, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		return nil, fmt.Errorf("метаданные: %w", err)
	}
	text, err := io.ReadAll(zr)
	if err != nil {
		return nil, fmt.Errorf("метаданные: %w", err)
	}
	return parseMetadata(text), nil
}

// parseMetadata разбирает вывод metadataScript: строки статистики «#имя\tчисло»
// и строки «UUID объекта\tUUID элемента\tвид\tномер\tимя».
func parseMetadata(text []byte) *Metadata {
	md := &Metadata{}
	byUUID := map[string]*MetaObject{}
	object := func(uuid string) *MetaObject {
		o, ok := byUUID[uuid]
		if !ok {
			o = &MetaObject{UUID: uuid}
			byUUID[uuid] = o
		}
		return o
	}

	sc := bufio.NewScanner(bytes.NewReader(text))
	sc.Buffer(make([]byte, 1<<20), 1<<20)
	for sc.Scan() {
		line := strings.TrimRight(sc.Text(), "\r")
		f := strings.Split(line, "\t")
		if strings.HasPrefix(line, "#") {
			if len(f) == 2 {
				n, _ := strconv.Atoi(f[1])
				switch f[0] {
				case "#dbnames":
					md.DBNames = n
				case "#files":
					md.Files = n
				case "#broken":
					md.Broken = n
				case "#truncated":
					md.Truncated = n
				}
			}
			continue
		}
		if len(f) != 5 {
			continue
		}
		num, err := strconv.Atoi(f[3])
		if err != nil {
			continue
		}
		o := object(f[0])
		if f[1] == f[0] {
			o.Kind, o.Num, o.Name = f[2], num, f[4]
			continue
		}
		if f[2] == "Fld" || f[2] == "VT" {
			o.Attrs = append(o.Attrs, MetaAttr{Kind: f[2], Num: num, Name: f[4]})
		}
	}

	for _, o := range byUUID {
		if o.Kind != "" {
			md.Objects = append(md.Objects, o)
		}
	}
	sort.Slice(md.Objects, func(i, j int) bool { return md.Objects[i].Title() < md.Objects[j].Title() })
	return md
}

// metadataScript продолжает psConnect: $conn уже открыт, перед ним заданы
// $kw (регулярка ключевых слов), $refs (номера справочников) и $maxLines.
// Вся работа — в C# (Add-Type компилирует его на хосте): циклы PowerShell
// по тысячам описаний объектов идут минутами. Реквизиты выводятся только для
// объектов, подходящих под $kw, и справочников из $refs; у остальных — имя и
// таблица. Вывод сразу пишется в gzip-поток, а не в одну строку в памяти.
const metadataScript = `
Add-Type -ReferencedAssemblies 'System.Data','System.Xml' -TypeDefinition @'
using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;

public static class OneCMeta {
  const string Uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  static readonly Regex DbRe = new Regex("\\{(" + Uuid + "),\"(\\w+)\",(\\d+)\\}");
  static readonly Regex ObjRe = new Regex("\\{\\d+,\\d+,(" + Uuid + ")\\},\"([^\"]*)\"");
  static readonly string[] Kinds = { "Fld", "VT", "Reference", "Document", "InfoRg", "AccumRg", "AccRg", "Enum", "Chrc", "Acc" };
  static readonly string[] Objects = { "Reference", "Document", "InfoRg", "AccumRg", "AccRg", "Enum", "Chrc", "Acc" };

  static string Inflate(byte[] b) {
    using (MemoryStream ms = new MemoryStream(b))
    using (DeflateStream ds = new DeflateStream(ms, CompressionMode.Decompress))
    using (StreamReader sr = new StreamReader(ds, Encoding.UTF8)) { return sr.ReadToEnd(); }
  }

  static string PartOrder(SqlConnection c, string table) {
    SqlCommand cmd = new SqlCommand("SELECT COL_LENGTH('" + table + "','PartNo')", c);
    object o = cmd.ExecuteScalar();
    return (o == null || o is DBNull) ? "" : ", PartNo";
  }

  class Run {
    public Dictionary<string, string[]> Map = new Dictionary<string, string[]>();
    public Regex Kw;
    public string[] Refs;
    public int MaxLines, Files, Broken, Lines, Truncated;
    public TextWriter W;

    public void Emit(string fn, byte[] b) {
      string[] kn;
      if (!Map.TryGetValue(fn, out kn) || Array.IndexOf(Objects, kn[0]) < 0) return;
      Files++;
      string t;
      try { t = Inflate(b); } catch { Broken++; return; }
      MatchCollection found = ObjRe.Matches(t);
      string own = "";
      foreach (Match m in found) { if (m.Groups[1].Value == fn) { own = m.Groups[2].Value; break; } }
      W.WriteLine(fn + "\t" + fn + "\t" + kn[0] + "\t" + kn[1] + "\t" + own); Lines++;
      bool want = Kw.IsMatch(own) || (kn[0] == "Reference" && Array.IndexOf(Refs, kn[1]) >= 0);
      if (!want) return;
      if (Lines >= MaxLines) { Truncated++; return; }
      Dictionary<string, bool> seen = new Dictionary<string, bool>();
      foreach (Match m in found) {
        string u = m.Groups[1].Value;
        string[] a;
        if (u == fn || seen.ContainsKey(u) || !Map.TryGetValue(u, out a)) continue;
        seen[u] = true;
        W.WriteLine(fn + "\t" + u + "\t" + a[0] + "\t" + a[1] + "\t" + m.Groups[2].Value); Lines++;
      }
    }
  }

  public static string Read(SqlConnection c, string kw, string[] refs, int maxLines) {
    MemoryStream gzMem = new MemoryStream();
    Run run = new Run();
    run.Kw = new Regex(kw);
    run.Refs = refs;
    run.MaxLines = maxLines;
    using (GZipStream gz = new GZipStream(gzMem, CompressionMode.Compress))
    using (StreamWriter w = new StreamWriter(gz, new UTF8Encoding(false))) {
      run.W = w;

      SqlCommand cmd = new SqlCommand("SELECT BinaryData FROM Params WHERE FileName = 'DBNames' ORDER BY FileName" + PartOrder(c, "Params"), c);
      cmd.CommandTimeout = 600;
      MemoryStream dbn = new MemoryStream();
      using (SqlDataReader r = cmd.ExecuteReader()) {
        while (r.Read()) { byte[] b = (byte[])r[0]; dbn.Write(b, 0, b.Length); }
      }
      foreach (Match m in DbRe.Matches(Inflate(dbn.ToArray()))) {
        string u = m.Groups[1].Value, k = m.Groups[2].Value;
        if (!run.Map.ContainsKey(u) && Array.IndexOf(Kinds, k) >= 0) run.Map[u] = new string[] { k, m.Groups[3].Value };
      }
      w.WriteLine("#dbnames\t" + run.Map.Count);

      cmd = new SqlCommand("SELECT FileName, BinaryData FROM Config WHERE LEN(FileName) = 36 ORDER BY FileName" + PartOrder(c, "Config"), c);
      cmd.CommandTimeout = 600;
      using (SqlDataReader r = cmd.ExecuteReader()) {
        string cur = null;
        MemoryStream ms = null;
        while (r.Read()) {
          string fn = r.GetString(0);
          if (fn != cur) { if (cur != null) run.Emit(cur, ms.ToArray()); cur = fn; ms = new MemoryStream(); }
          if (!r.IsDBNull(1)) { byte[] b = (byte[])r[1]; ms.Write(b, 0, b.Length); }
        }
        if (cur != null) run.Emit(cur, ms.ToArray());
      }
      w.WriteLine("#files\t" + run.Files);
      w.WriteLine("#broken\t" + run.Broken);
      w.WriteLine("#truncated\t" + run.Truncated);
    }
    return Convert.ToBase64String(gzMem.ToArray());
  }
}
'@
try { [OneCMeta]::Read($conn, $kw, [string[]]$refs, $maxLines) } finally { $conn.Close() }
`
