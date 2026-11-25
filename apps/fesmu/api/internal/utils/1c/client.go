// Package onec — доступ к БД 1С (SQL Server внутри ВМ sqlbuhz) только на чтение.
//
// Слои (см. 1c-reference.md, раздел 7):
//   - client.go     — транспорт: подключение, read-only guard, разбор CSV.
//     Не знает ни про одну базу и ни про один счёт.
//   - schema.go     — карта базы: номера таблиц/полей конкретной конфигурации.
//   - accounting.go — бизнес-методы по бухгалтерии (регистр, счета).
//
// Использование:
//
//	c, err := onec.New(cfg.OneC) // cfg — *config.Config
//	acc := onec.NewAccounting(c, onec.SchemaBGU2)
//	rows, err := acc.TuitionBalance(ctx)
package onec

// Временный транспорт через WinRM-хост.
// Путь: bibl-03 --WinRM 5985--> 192.168.21.6 --TDS 1433--> 192.168.250.2
//
// Костыль на период согласования проброса порта. Когда на хосте появится
// portproxy 21.6:14330 -> 250.2:1433, этот файл заменяется на прямое
// подключение через github.com/microsoft/go-mssqldb, а WinRM убирается.
// Сигнатура Client.Query при этом не меняется.
//
// Только чтение: запрос обязан начинаться с SELECT/WITH, на сервере всё
// выполняется в транзакции, которая всегда откатывается (ROLLBACK).

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/csv"
	"encoding/hex"
	"fmt"
	"html"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf16"

	"dvgmu/api/internal/config"

	"github.com/masterzen/winrm"
)

// Config — параметры доступа; заполняется из ENV (ONEC_*) в internal/config.
type Config = config.OneCConfig

// Client — подключение к одной базе 1С. Безопасен для конкурентного использования.
type Client struct {
	cfg      Config
	endpoint *winrm.Endpoint
	params   *winrm.Parameters

	// Команды к хосту — строго по одной. Транспорт с NTLM-шифрованием берёт
	// HTTP-соединения из общего пула (http.DefaultTransport), а NTLM
	// аутентифицирует соединение: параллельные команды получают чужое
	// соединение и 401 («invalid content type»).
	mu sync.Mutex
}

// New создаёт клиента. Сетевого соединения на этом шаге нет.
func New(cfg Config) (*Client, error) {
	if cfg.HostUser == "" || cfg.HostPass == "" || cfg.SQLUser == "" || cfg.SQLPass == "" {
		return nil, fmt.Errorf("1С: не заданы ONEC_HOST_USER/ONEC_HOST_PASSWORD/ONEC_SQL_USER/ONEC_SQL_PASSWORD")
	}

	endpoint := winrm.NewEndpoint(cfg.HostAddr, cfg.HostPort, false, false, nil, nil, nil, cfg.Timeout)
	// Копия, а не указатель на глобальные параметры библиотеки. Таймаут
	// операции WinRM меньше HTTP-таймаута (cfg.Timeout): долгая команда
	// (разбор метаданных) опрашивается повторными receive, и каждый из них
	// должен вернуться раньше, чем HTTP-клиент оборвёт ожидание.
	p := *winrm.DefaultParameters
	params := &p
	params.Timeout = "PT20S"
	// Домен -> NTLM, с шифрованием сообщений: по HTTP (5985) Windows по
	// умолчанию (AllowUnencrypted=false) отвечает 401 на нешифрованный запрос.
	// Так же работает pywinrm; при AllowUnencrypted=true шифрование не мешает.
	params.TransportDecorator = func() winrm.Transporter {
		enc, err := winrm.NewEncryption("ntlm")
		if err != nil {
			panic(err) // "ntlm" поддерживается всегда; ошибка только для других протоколов
		}
		return enc
	}

	c := &Client{cfg: cfg, endpoint: endpoint, params: params}
	if _, err := c.winrmClient(); err != nil {
		return nil, err
	}
	return c, nil
}

// winrmClient — новый клиент WinRM на каждую команду: транспорт с NTLM-
// шифрованием хранит сессию в себе и перезаписывает её на каждом запросе.
// Создание клиента сетевых запросов не делает.
func (c *Client) winrmClient() (*winrm.Client, error) {
	wc, err := winrm.NewClientWithParameters(c.endpoint, c.cfg.HostUser, c.cfg.HostPass, c.params)
	if err != nil {
		return nil, fmt.Errorf("winrm client: %w", err)
	}
	return wc, nil
}

// DB — имя базы, к которой подключён клиент.
func (c *Client) DB() string { return c.cfg.DB }

// Query выполняет читающий SQL и возвращает строки (первая — заголовок).
func (c *Client) Query(ctx context.Context, sqlText string) ([][]string, error) {
	if err := assertReadOnly(sqlText); err != nil {
		return nil, err
	}

	raw, err := c.run(ctx, psConnect(c.cfg), queryBody(sqlText))
	if err != nil {
		return nil, err
	}

	r := csv.NewReader(bytes.NewReader(raw))
	r.Comma = ';'
	r.FieldsPerRecord = -1
	return r.ReadAll()
}

// run выполняет на хосте скрипт header+body и возвращает его результат:
// последнюю строку stdout, декодированную из base64. header — подключение к
// SQL (psConnect, с паролем), body — сама работа.
func (c *Client) run(ctx context.Context, header, body string) ([]byte, error) {
	id, err := uploadID()
	if err != nil {
		return nil, err
	}
	cmds := plan(header, body, id)
	for _, cmd := range cmds[:len(cmds)-1] {
		if _, err := c.exec(ctx, cmd); err != nil {
			c.cleanup(id)
			return nil, fmt.Errorf("передача скрипта на хост: %w", err)
		}
	}
	stdout, err := c.exec(ctx, cmds[len(cmds)-1])
	if err != nil {
		if len(cmds) > 1 {
			c.cleanup(id)
		}
		return nil, err
	}

	lines := strings.Fields(strings.TrimSpace(stdout))
	if len(lines) == 0 {
		return nil, fmt.Errorf("пустой ответ")
	}
	raw, err := base64.StdEncoding.DecodeString(lines[len(lines)-1])
	if err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	return raw, nil
}

// exec выполняет одну команду и возвращает stdout.
func (c *Client) exec(ctx context.Context, cmd string) (string, error) {
	var stdout, stderr bytes.Buffer
	wc, err := c.winrmClient()
	if err != nil {
		return "", err
	}
	c.mu.Lock()
	code, err := wc.RunWithContext(ctx, cmd, &stdout, &stderr)
	c.mu.Unlock()
	if err != nil {
		return "", fmt.Errorf("winrm run: %w", err)
	}
	// В stderr PowerShell пишет не только ошибки, но и служебные записи
	// (прогресс «Preparing modules for first use») — ошибкой считаем только
	// ненулевой код или настоящие Error-записи.
	if msg := remoteErrors(stderr.String()); code != 0 || msg != "" {
		if msg == "" {
			msg = strings.TrimSpace(stderr.String())
		}
		return "", fmt.Errorf("удалённая ошибка (код %d): %s", code, msg)
	}
	return stdout.String(), nil
}

// cleanup удаляет недолитый или невыполненный файл скрипта на хосте.
func (c *Client) cleanup(id string) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	_, _ = c.exec(ctx, psCommand("Remove-Item -LiteralPath "+uploadPath(id)+" -ErrorAction SilentlyContinue"))
}

// queryRows — Query без строки заголовка; строки короче minCols отбрасываются.
func (c *Client) queryRows(ctx context.Context, sqlText string, minCols int) ([][]string, error) {
	rows, err := c.Query(ctx, sqlText)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	out := rows[:0]
	for _, row := range rows[1:] {
		if len(row) >= minCols {
			out = append(out, row)
		}
	}
	return out, nil
}

var (
	reCLIXMLError = regexp.MustCompile(`(?s)<S S="Error">(.*?)</S>`)
	reCLIXMLEsc   = regexp.MustCompile(`_x([0-9A-Fa-f]{4})_`)
)

// remoteErrors достаёт текст Error-записей из CLIXML, которым PowerShell
// сериализует stderr по WinRM. Нет Error-записей — пустая строка.
func remoteErrors(stderr string) string {
	if !strings.Contains(stderr, "CLIXML") {
		return strings.TrimSpace(stderr)
	}
	var b strings.Builder
	for _, m := range reCLIXMLError.FindAllStringSubmatch(stderr, -1) {
		b.WriteString(html.UnescapeString(m[1]))
	}
	msg := reCLIXMLEsc.ReplaceAllStringFunc(b.String(), func(e string) string {
		var r rune
		fmt.Sscanf(e[2:6], "%04x", &r)
		return string(r)
	})
	return strings.Join(strings.Fields(msg), " ")
}

// parseFloat разбирает число из CSV (инвариантная культура, пусто = 0).
func parseFloat(s string) float64 {
	var f float64
	fmt.Sscanf(strings.TrimSpace(s), "%f", &f)
	return f
}

var (
	reStart     = regexp.MustCompile(`(?is)^\s*(SELECT|WITH)\b`)
	reForbidden = regexp.MustCompile(`(?i)\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|` +
		`EXEC|EXECUTE|GRANT|REVOKE|DENY|INTO|BACKUP|RESTORE|DBCC|SHUTDOWN|KILL|OPENROWSET|` +
		`OPENQUERY|OPENDATASOURCE|BULK|COMMIT|ROLLBACK|BEGIN|SAVE|RECONFIGURE|SP_\w+|XP_\w+)\b`)
	reString  = regexp.MustCompile(`'(?:[^']|'')*'`)
	reBracket = regexp.MustCompile(`\[[^\]]*\]`)
	reComment = regexp.MustCompile(`(?s)--[^\n]*|/\*.*?\*/`)
)

// assertReadOnly отбраковывает всё, кроме чтения, ещё до отправки на сервер.
func assertReadOnly(sql string) error {
	s := reComment.ReplaceAllString(sql, " ")
	s = reString.ReplaceAllString(s, "''")
	s = reBracket.ReplaceAllString(s, "[x]")
	if !reStart.MatchString(s) {
		return fmt.Errorf("разрешён только SELECT/WITH")
	}
	if m := reForbidden.FindString(s); m != "" {
		return fmt.Errorf("запрещённое слово в запросе: %s", m)
	}
	return nil
}

// buildScript — полный скрипт запроса: подключение + queryBody.
func buildScript(cfg Config, sqlText string) string { return psConnect(cfg) + queryBody(sqlText) }

// queryBody — выполнение SQL в транзакции с ROLLBACK и вывод CSV в base64.
// Продолжает psConnect: $conn уже открыт.
func queryBody(sqlText string) string {
	return fmt.Sprintf(`$sql=D('%s')
$tx=$conn.BeginTransaction([System.Data.IsolationLevel]::ReadUncommitted)
try{
  $cmd=$conn.CreateCommand(); $cmd.Transaction=$tx; $cmd.CommandText=$sql; $cmd.CommandTimeout=600
  $r=$cmd.ExecuteReader()
  $sb=New-Object System.Text.StringBuilder
  $esc={param($s) '"'+($s -replace '"','""')+'"'}
  $names=for($i=0;$i -lt $r.FieldCount;$i++){ & $esc $r.GetName($i) }
  [void]$sb.AppendLine(($names -join ';'))
  while($r.Read()){
    $vals=for($i=0;$i -lt $r.FieldCount;$i++){
      $v=$r.GetValue($i)
      if($v -is [DBNull]){''}
      elseif($v -is [byte[]]){'0x'+[BitConverter]::ToString($v).Replace('-','')}
      elseif($v -is [datetime]){$v.ToString('yyyy-MM-dd HH:mm:ss')}
      elseif($v -is [decimal] -or $v -is [double]){$v.ToString([Globalization.CultureInfo]::InvariantCulture)}
      else{ & $esc ([string]$v) }
    }
    [void]$sb.AppendLine(($vals -join ';'))
  }
  $r.Close()
  [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($sb.ToString()))
}finally{ $tx.Rollback(); $conn.Close() }
`, b64(sqlText))
}

func b64(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }

// maxCommandLine — чуть ниже лимита cmd.exe в 8191 символ («The command line
// is too long»). Замерено: запрос оборотов страницы (~7700) проходит, запросы
// длиной ~8650 и ~8850 — нет.
const maxCommandLine = 8000

// uploadChunk — сколько символов base64 тела заливать одной командой, чтобы
// команда с обёрткой гарантированно уложилась в maxCommandLine.
const uploadChunk = 2500

// psCommand — команда запуска скрипта через -EncodedCommand.
func psCommand(script string) string {
	return "powershell -NoProfile -NonInteractive -EncodedCommand " + encodePS(script)
}

// plan разбивает скрипт на команды. Если header+body помещается в командную
// строку — одна команда, как всегда. Иначе тело (без пароля) дописывается
// частями во временный файл на хосте, а последняя команда — подключение и
// загрузчик, который читает файл, удаляет его и выполняет тело. stdin не
// годится: с NTLM-шифрованием библиотека WinRM его не передаёт (EOF/401).
func plan(header, body, id string) []string {
	if cmd := psCommand(header + body); len(cmd) <= maxCommandLine {
		return []string{cmd}
	}
	enc := b64(body)
	var cmds []string
	for len(enc) > 0 {
		n := min(uploadChunk, len(enc))
		cmds = append(cmds, psCommand("[IO.File]::AppendAllText("+uploadPath(id)+",'"+enc[:n]+"')"))
		enc = enc[n:]
	}
	return append(cmds, psCommand(header+"$f="+uploadPath(id)+
		"; $code=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([IO.File]::ReadAllText($f)))"+
		"; Remove-Item -LiteralPath $f; Invoke-Expression $code"))
}

// uploadPath — выражение PowerShell с путём временного файла тела скрипта.
func uploadPath(id string) string {
	return "([IO.Path]::Combine([IO.Path]::GetTempPath(),'fesmu-1c-" + id + ".b64'))"
}

func uploadID() (string, error) {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", fmt.Errorf("uploadID: %w", err)
	}
	return hex.EncodeToString(b[:]), nil
}

// psConnect — общее начало скрипта: строгий режим и открытое соединение
// $conn с SQL Server. Значения передаются base64, чтобы не возиться с
// кавычками и кодировкой; builder сам экранирует пароль с ; = или кавычками.
func psConnect(cfg Config) string {
	return fmt.Sprintf(`
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
function D($s){[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($s))}
$srv=D('%s'); $db=D('%s'); $usr=D('%s'); $pwd=D('%s')
$csb=New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$csb['Data Source']=$srv; $csb['Initial Catalog']=$db; $csb['User ID']=$usr; $csb['Password']=$pwd
$csb['Connect Timeout']=15; $csb['Application Name']='fesmu-api-ro'
$conn=New-Object System.Data.SqlClient.SqlConnection $csb.ConnectionString
$conn.Open()
`, b64(cfg.SQLServer), b64(cfg.DB), b64(cfg.SQLUser), b64(cfg.SQLPass))
}

// encodePS кодирует скрипт в UTF-16LE base64 для powershell -EncodedCommand.
func encodePS(script string) string {
	u := utf16.Encode([]rune(script))
	buf := make([]byte, len(u)*2)
	for i, r := range u {
		buf[i*2] = byte(r)
		buf[i*2+1] = byte(r >> 8)
	}
	return base64.StdEncoding.EncodeToString(buf)
}
