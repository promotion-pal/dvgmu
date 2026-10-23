package onec

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"
	"unicode/utf16"
)

func TestRemoteErrors(t *testing.T) {
	// Реальный stderr из лога: прогресс + ошибка входа в SQL.
	const failed = `#< CLIXML
<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04"><Obj S="progress" RefId="0"><TN RefId="0"><T>System.Management.Automation.PSCustomObject</T><T>System.Object</T></TN><MS><I64 N="SourceId">1</I64><PR N="Record"><AV>Preparing modules for first use.</AV><AI>0</AI><Nil /><PI>-1</PI><PC>-1</PC><T>Completed</T><SR>-1</SR><SD> </SD></PR></MS></Obj><S S="Error">Exception calling "Open" with "0" argument(s): "Ошибка входа пользователя "sa"."_x000D__x000A_</S><S S="Error">At line:7 char:1_x000D__x000A_</S></Objs>`
	want := `Exception calling "Open" with "0" argument(s): "Ошибка входа пользователя "sa"." At line:7 char:1`
	if got := remoteErrors(failed); got != want {
		t.Fatalf("got  %q\nwant %q", got, want)
	}

	const progressOnly = `#< CLIXML
<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04"><Obj S="progress" RefId="0"><MS><PR N="Record"><AV>Preparing modules for first use.</AV></PR></MS></Obj></Objs>`
	if got := remoteErrors(progressOnly); got != "" {
		t.Fatalf("progress-only stderr must not be an error, got %q", got)
	}

	if got := remoteErrors(""); got != "" {
		t.Fatalf("empty stderr: got %q", got)
	}
}

// decodePS — обратное к psCommand: текст скрипта из команды.
func decodePS(t *testing.T, cmd string) string {
	t.Helper()
	raw, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(cmd, "powershell -NoProfile -NonInteractive -EncodedCommand "))
	if err != nil {
		t.Fatal(err)
	}
	u := make([]uint16, len(raw)/2)
	for i := range u {
		u[i] = uint16(raw[2*i]) | uint16(raw[2*i+1])<<8
	}
	return string(utf16.Decode(u))
}

var testCfg = Config{SQLServer: "192.168.250.2,1433", DB: "bgu2", SQLUser: "sa", SQLPass: "pa$$w0rd;secret"}

func TestPlanKeepsPageQueryInOneCommand(t *testing.T) {
	// The page's turnover query worked in production as one command; it must stay so.
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC)
	body := queryBody((&Accounting{s: SchemaBGU2}).turnoverSQL(AccountTuition, from, to))
	cmds := plan(psConnect(testCfg), body, "abc")
	if len(cmds) != 1 || len(cmds[0]) > maxCommandLine {
		t.Fatalf("page query: %d commands, first %d chars", len(cmds), len(cmds[0]))
	}
	if decodePS(t, cmds[0]) != psConnect(testCfg)+body {
		t.Fatal("single command must carry the script unchanged")
	}
}

func TestPlanUploadsLongScriptInChunks(t *testing.T) {
	header := psConnect(testCfg)
	cmds := plan(header, metadataScript, "abc")
	if len(cmds) < 2 {
		t.Fatalf("metadata script must be uploaded, got %d command(s)", len(cmds))
	}
	var uploaded strings.Builder
	for i, cmd := range cmds {
		if len(cmd) > maxCommandLine {
			t.Fatalf("command %d is %d chars", i, len(cmd))
		}
		script := decodePS(t, cmd)
		if i == len(cmds)-1 {
			if !strings.HasPrefix(script, header) || !strings.Contains(script, "Invoke-Expression $code") {
				t.Fatalf("last command must connect and run the upload:\n%s", script)
			}
			continue
		}
		if strings.Contains(script, b64(testCfg.SQLPass)) {
			t.Fatal("the password must not be written to the host's temp file")
		}
		start := strings.LastIndex(script, ",'") + 2
		uploaded.WriteString(script[start : len(script)-2])
	}
	if uploaded.String() != b64(metadataScript) {
		t.Fatal("chunks do not reassemble into the script body")
	}
}
