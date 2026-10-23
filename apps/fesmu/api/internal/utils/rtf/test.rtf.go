// Package rtf builds test documents in the template format used for the
// testing system (dvgmu_apps/utils/csv2rtf/docs/template.rtf).
package rtf

import (
	"fmt"
	"strconv"
	"strings"
)

type Test struct {
	Topic     string
	Questions []Question
}

type Question struct {
	Text    string
	Options []Option
	// Shown between "Задание № N" and the question's text, as the testing
	// system's files have it.
	Image *Image
}

// Image is a question's picture: JPEG or PNG, its size in pixels.
type Image struct {
	Data          []byte
	PNG           bool
	Width, Height int
}

// The widest a picture may be: the page's text width (A4 less the margins), in twips.
const maxImageTwips = 11906 - 1701 - 850

type Option struct {
	Text    string
	Correct bool
}

const header = `{\rtf1\ansi\ansicpg1251\deff0\uc1
{\fonttbl{\f0\froman\fprq2\fcharset204 Times New Roman;}{\f1\fswiss\fprq2\fcharset204 Microsoft Sans Serif;}}
\paperw11906\paperh16838\margl1701\margr850\margt1134\margb1134
\sectd\pgwsxn11906\pghsxn16838\marglsxn1701\margrsxn850\margtsxn1134\margbsxn1134
`

const (
	pLeft   = `\pard\plain\ql\nowidctlpar\fi0\li0\ri0\sb0\sa0\sl252\slmult1\f1\fs20\lang1049 `
	pCenter = `\pard\plain\qc\nowidctlpar\fi0\li0\ri0\sb0\sa0\sl252\slmult1\f1\fs20\lang1049 `
	pOption = `\pard\plain\ql\nowidctlpar\fi0\li600\ri0\sb0\sa0\sl252\slmult1\f1\fs20\lang1049 `
)

// TestDocument renders the test: "Тема", then every question as "Задание № N",
// its text and the numbered options; a correct option has its number in bold
// and underlined.
func TestDocument(t Test) []byte {
	var b strings.Builder
	b.WriteString(header)

	b.WriteString(pLeft + text("Тема: "+oneLine(t.Topic)) + "\\par\n")
	for n, q := range t.Questions {
		b.WriteString(pCenter + "{\\b " + text(fmt.Sprintf("Задание № %d", n+1)) + "}\\par\n")
		if q.Image != nil && len(q.Image.Data) > 0 {
			b.WriteString(pCenter + picture(q.Image) + "\\par\n")
		}
		b.WriteString(pCenter + text(oneLine(q.Text)) + "\\par\n")
		b.WriteString(pCenter + "\\par\n")
		b.WriteString(pLeft + text("Ответ: ") + "\\par\n")
		for i, o := range q.Options {
			num := strconv.Itoa(i+1) + "."
			if o.Correct {
				num = "{\\b\\ul " + num + "}"
			}
			b.WriteString(pOption + num + " " + text(oneLine(o.Text)) + "\\par\n")
		}
		b.WriteString(pLeft + "\\par\n")
	}
	b.WriteString("}\n")
	return []byte(b.String())
}

// FileName turns a topic into a safe "<topic>.rtf".
func FileName(topic string) string {
	s := strings.Map(func(r rune) rune {
		switch r {
		case '/', '\\', ':', '*', '?', '"', '<', '>', '|':
			return '_'
		}
		if r < 32 {
			return -1
		}
		return r
	}, topic)
	s = strings.Trim(strings.TrimSpace(s), ".")
	if r := []rune(s); len(r) > 120 {
		s = strings.TrimSpace(string(r[:120]))
	}
	if s == "" {
		s = "test"
	}
	return s + ".rtf"
}

func oneLine(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

// text escapes RTF control characters and writes non-ASCII as \uN? so the
// file reads the same in any code page.
func text(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r == '\\' || r == '{' || r == '}':
			b.WriteByte('\\')
			b.WriteRune(r)
		case r == '\t':
			b.WriteString(`\tab `)
		case r < 0x80:
			b.WriteRune(r)
		case r > 0xFFFF:
			r -= 0x10000
			fmt.Fprintf(&b, `\u%d?\u%d?`, int16(uint16(0xD800+(r>>10)&0x3FF)), int16(uint16(0xDC00+r&0x3FF)))
		default:
			fmt.Fprintf(&b, `\u%d?`, int16(uint16(r)))
		}
	}
	return b.String()
}

// picture embeds img as the testing system's files do:
// {\*\shppict{\pict\jpegblip\picwgoal…\pichgoal… <hex>}}. At 96 dpi a pixel is
// 15 twips; a picture wider than the page is scaled down to fit.
func picture(img *Image) string {
	w, h := img.Width*15, img.Height*15
	if w > maxImageTwips && w > 0 {
		h = h * maxImageTwips / w
		w = maxImageTwips
	}
	kind := "\\jpegblip"
	if img.PNG {
		kind = "\\pngblip"
	}
	var b strings.Builder
	fmt.Fprintf(&b, "{\\*\\shppict{\\pict%s\\picw%d\\pich%d\\picwgoal%d\\pichgoal%d\n", kind, img.Width, img.Height, w, h)
	const hexdigits = "0123456789abcdef"
	for i, c := range img.Data {
		b.WriteByte(hexdigits[c>>4])
		b.WriteByte(hexdigits[c&0x0f])
		if i%64 == 63 {
			b.WriteByte('\n')
		}
	}
	b.WriteString("}}")
	return b.String()
}
