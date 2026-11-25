// Package docx reads tests from the .docx files they are supplied in: a
// question paragraph, then one paragraph per option, the correct ones
// starting with "@"; questions are separated by an empty paragraph.
package docx

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
)

var ErrNotDocx = errors.New("файл не похож на .docx")

const wordML = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

type Test struct {
	Questions []Question
	// Warnings point at what needs a look before saving, e.g. "вопрос 3: ...".
	Warnings []string
}

type Question struct {
	Text    string
	Options []Option
	// The picture standing before the question (or in it), when there is one.
	Image *Image
}

// Image is a picture taken out of the file, with its size as placed in Word.
type Image struct {
	Data []byte
	// "image/jpeg" or "image/png" — the formats the test images take.
	Mime string
	// In EMU (914400 per inch); 0 when the file doesn't say.
	WidthEMU, HeightEMU int64
}

type Option struct {
	Text    string
	Correct bool
}

type paragraph struct {
	text string
	// Pictures in the paragraph that could be read; unreadable counts the
	// rest (old VML pictures, embedded objects, unsupported formats).
	images     []*Image
	unreadable int
}

// ParseTest reads the questions out of a .docx file.
func ParseTest(data []byte) (Test, error) {
	paragraphs, err := readParagraphs(data)
	if err != nil {
		return Test{}, err
	}

	type block struct {
		lines      []string
		images     []*Image
		unreadable int
	}
	var blocks []block
	var cur block
	var pendingImages []*Image
	pendingUnreadable := 0
	flush := func() {
		if len(cur.lines) > 0 {
			blocks = append(blocks, cur)
		}
		cur = block{}
	}
	for _, p := range paragraphs {
		text := strings.Join(strings.Fields(p.text), " ")
		if text == "" {
			// A picture on its own line belongs to the question below it.
			pendingImages = append(pendingImages, p.images...)
			pendingUnreadable += p.unreadable
			flush()
			continue
		}
		if len(cur.lines) == 0 {
			cur.images, cur.unreadable = append(cur.images, pendingImages...), cur.unreadable+pendingUnreadable
			pendingImages, pendingUnreadable = nil, 0
		}
		cur.images = append(cur.images, p.images...)
		cur.unreadable += p.unreadable
		cur.lines = append(cur.lines, text)
	}
	flush()

	var t Test
	optionCounts := map[int]int{}
	for _, b := range blocks {
		n := len(t.Questions) + 1
		q := Question{Text: strings.TrimSpace(strings.TrimPrefix(b.lines[0], "@"))}
		if strings.HasPrefix(b.lines[0], "@") {
			t.Warnings = append(t.Warnings, fmt.Sprintf("вопрос %d: текст вопроса начинается с «@» — возможно, пропущена пустая строка перед ним", n))
		}
		for _, line := range b.lines[1:] {
			correct := strings.HasPrefix(line, "@")
			q.Options = append(q.Options, Option{Text: strings.TrimSpace(strings.TrimPrefix(line, "@")), Correct: correct})
		}
		if len(b.images) > 0 {
			q.Image = b.images[0]
		}
		if len(b.images) > 1 {
			t.Warnings = append(t.Warnings, fmt.Sprintf("вопрос %d: в файле %d изображения, взято первое", n, len(b.images)))
		}
		if b.unreadable > 0 {
			t.Warnings = append(t.Warnings, fmt.Sprintf("вопрос %d: изображение в формате, который не импортируется (нужен JPEG или PNG) — добавьте его в вопрос вручную", n))
		}
		if !hasCorrect(q.Options) {
			t.Warnings = append(t.Warnings, fmt.Sprintf("вопрос %d: не отмечен верный вариант («@»)", n))
		}
		optionCounts[len(q.Options)]++
		t.Questions = append(t.Questions, q)
	}
	if len(t.Questions) == 0 {
		return Test{}, errors.New("в файле не найдено ни одного вопроса")
	}

	// A different number of options than usual for the file is most often an
	// option wrapped onto a second line, or two questions run together.
	usual := 0
	for count, times := range optionCounts {
		if times > optionCounts[usual] || times == optionCounts[usual] && count < usual {
			usual = count
		}
	}
	for i, q := range t.Questions {
		if len(q.Options) != usual {
			t.Warnings = append(t.Warnings, fmt.Sprintf("вопрос %d: %d вариантов ответа вместо обычных %d — проверьте, не разбит ли вариант на две строки", i+1, len(q.Options), usual))
		}
	}
	return t, nil
}

func hasCorrect(options []Option) bool {
	for _, o := range options {
		if o.Correct {
			return true
		}
	}
	return false
}

const (
	drawingML    = "http://schemas.openxmlformats.org/drawingml/2006/main"
	wordDrawing  = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
	relationship = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
)

// readParagraphs returns the body's paragraphs in order. Text inside drawings
// and text boxes is skipped; a drawing's picture is read out of the file.
func readParagraphs(data []byte) ([]paragraph, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, ErrNotDocx
	}
	files := map[string]*zip.File{}
	for _, f := range zr.File {
		files[f.Name] = f
	}
	doc := files["word/document.xml"]
	if doc == nil {
		return nil, ErrNotDocx
	}
	targets, err := readRelationships(files["word/_rels/document.xml.rels"])
	if err != nil {
		return nil, err
	}
	// A picture used by several questions is read once.
	read := map[string]*Image{}
	picture := func(id string, cx, cy int64) *Image {
		target, ok := targets[id]
		if !ok {
			return nil
		}
		if img, ok := read[target]; ok {
			return &Image{Data: img.Data, Mime: img.Mime, WidthEMU: cx, HeightEMU: cy}
		}
		mime := imageMime(target)
		f := files[path.Join("word", target)]
		if mime == "" || f == nil {
			return nil
		}
		rc, err := f.Open()
		if err != nil {
			return nil
		}
		defer rc.Close()
		body, err := io.ReadAll(rc)
		if err != nil {
			return nil
		}
		read[target] = &Image{Data: body, Mime: mime}
		return &Image{Data: body, Mime: mime, WidthEMU: cx, HeightEMU: cy}
	}

	rc, err := doc.Open()
	if err != nil {
		return nil, fmt.Errorf("open document.xml: %w", err)
	}
	defer rc.Close()

	var (
		out       []paragraph
		cur       *paragraph
		depth     int // nesting of <w:p>; only the outermost one is a paragraph
		inDrawing int
		inText    bool
		// The drawing being read: its size and whether a picture was found.
		cx, cy  int64
		gotBlip bool
	)
	dec := xml.NewDecoder(rc)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read document.xml: %w", err)
		}
		switch el := tok.(type) {
		case xml.StartElement:
			switch {
			case el.Name.Local == "drawing" || el.Name.Local == "pict" || el.Name.Local == "object":
				if inDrawing == 0 {
					cx, cy, gotBlip = 0, 0, false
				}
				inDrawing++
			case el.Name.Space == wordDrawing && el.Name.Local == "extent" && inDrawing > 0:
				cx, cy = attrInt(el, "", "cx"), attrInt(el, "", "cy")
			case el.Name.Space == drawingML && el.Name.Local == "blip" && inDrawing > 0 && cur != nil && !gotBlip:
				gotBlip = true
				if img := picture(attr(el, relationship, "embed"), cx, cy); img != nil {
					cur.images = append(cur.images, img)
				} else {
					cur.unreadable++
				}
			case el.Name.Space != wordML || inDrawing > 0:
			case el.Name.Local == "p":
				depth++
				if depth == 1 {
					cur = &paragraph{}
				}
			case el.Name.Local == "t":
				inText = true
			case el.Name.Local == "br" || el.Name.Local == "cr" || el.Name.Local == "tab":
				if cur != nil {
					cur.text += " "
				}
			}
		case xml.EndElement:
			switch {
			case el.Name.Local == "drawing" || el.Name.Local == "pict" || el.Name.Local == "object":
				inDrawing--
				// A VML picture or an embedded object: no picture we can take.
				if inDrawing == 0 && !gotBlip && cur != nil {
					cur.unreadable++
				}
			case el.Name.Space != wordML || inDrawing > 0:
			case el.Name.Local == "t":
				inText = false
			case el.Name.Local == "p":
				depth--
				if depth == 0 && cur != nil {
					out = append(out, *cur)
					cur = nil
				}
			}
		case xml.CharData:
			if inText && inDrawing == 0 && cur != nil {
				cur.text += string(el)
			}
		}
	}
	return out, nil
}

// readRelationships maps relationship ids to their targets ("media/image1.jpeg").
func readRelationships(f *zip.File) (map[string]string, error) {
	out := map[string]string{}
	if f == nil {
		return out, nil
	}
	rc, err := f.Open()
	if err != nil {
		return nil, fmt.Errorf("open relationships: %w", err)
	}
	defer rc.Close()
	var rels struct {
		Items []struct {
			ID     string `xml:"Id,attr"`
			Target string `xml:"Target,attr"`
			Mode   string `xml:"TargetMode,attr"`
		} `xml:"Relationship"`
	}
	if err := xml.NewDecoder(rc).Decode(&rels); err != nil {
		return nil, fmt.Errorf("read relationships: %w", err)
	}
	for _, r := range rels.Items {
		if r.Mode != "External" {
			out[r.ID] = strings.TrimPrefix(r.Target, "/word/")
		}
	}
	return out, nil
}

func imageMime(name string) string {
	switch strings.ToLower(path.Ext(name)) {
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	}
	return ""
}

func attr(el xml.StartElement, space, local string) string {
	for _, a := range el.Attr {
		if a.Name.Local == local && (space == "" || a.Name.Space == space) {
			return a.Value
		}
	}
	return ""
}

func attrInt(el xml.StartElement, space, local string) int64 {
	n, _ := strconv.ParseInt(attr(el, space, local), 10, 64)
	return n
}
