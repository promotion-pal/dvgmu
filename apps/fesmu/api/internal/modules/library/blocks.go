package library

import (
	"net/url"
	"strconv"
	"strings"

	"google.golang.org/protobuf/encoding/protojson"

	entity "fesmu/contract/fesmu/entity/v2"
)

// Limits on one manual, so a draft stays a document and not a dump.
const (
	maxSections     = 200
	maxBlocks       = 3000
	maxContentBytes = 4 << 20
)

// encodeSections stores sections as protojson of a Manual holding only them.
func encodeSections(sections []*entity.ManualSection) ([]byte, error) {
	return protojson.Marshal(&entity.Manual{Sections: sections})
}

func decodeSections(raw []byte) ([]*entity.ManualSection, error) {
	if len(raw) == 0 {
		return nil, nil
	}
	var m entity.Manual
	if err := (protojson.UnmarshalOptions{DiscardUnknown: true}).Unmarshal(raw, &m); err != nil {
		return nil, err
	}
	return m.GetSections(), nil
}

// refs are the files and catalog entries a manual's blocks point at.
type refs struct {
	files []int64
	items []int64
}

// checkSections validates a draft before it is saved and says what it points
// at; the caller checks those exist.
func checkSections(sections []*entity.ManualSection) (refs, error) {
	var r refs
	if len(sections) > maxSections {
		return r, invalid("слишком много тем: %d, не больше %d", len(sections), maxSections)
	}
	ids := map[string]bool{}
	seenFile := map[int64]bool{}
	seenItem := map[int64]bool{}
	addFile := func(f *entity.LibraryFile) {
		if id := f.GetId(); id > 0 && !seenFile[id] {
			seenFile[id] = true
			r.files = append(r.files, id)
		}
	}
	blocks := 0
	for si, s := range sections {
		if strings.TrimSpace(s.GetId()) == "" || ids[s.GetId()] {
			return r, invalid("у темы %d нет уникального id", si+1)
		}
		ids[s.GetId()] = true
		if strings.TrimSpace(s.GetTitle()) == "" {
			return r, invalid("у темы %d нет названия", si+1)
		}
		for bi, b := range s.GetBlocks() {
			blocks++
			where := func() string { return "«" + s.GetTitle() + "», блок " + strconv.Itoa(bi+1) }
			if strings.TrimSpace(b.GetId()) == "" || ids[b.GetId()] {
				return r, invalid("%s: нет уникального id", where())
			}
			ids[b.GetId()] = true
			switch body := b.GetBody().(type) {
			case nil:
				return r, invalid("%s: пустой блок", where())
			case *entity.ManualBlock_Heading:
				if lvl := body.Heading.GetLevel(); lvl < 2 || lvl > 4 {
					body.Heading.Level = 2
				}
			case *entity.ManualBlock_Figure:
				if body.Figure.GetFile().GetId() == 0 {
					return r, invalid("%s: у рисунка нет изображения", where())
				}
				addFile(body.Figure.GetFile())
			case *entity.ManualBlock_Attachment:
				if body.Attachment.GetFile().GetId() == 0 {
					return r, invalid("%s: не выбран файл", where())
				}
				addFile(body.Attachment.GetFile())
			case *entity.ManualBlock_Video:
				if !isWebURL(body.Video.GetUrl()) {
					return r, invalid("%s: ссылка на видео должна начинаться с http:// или https://", where())
				}
			case *entity.ManualBlock_Quiz:
				for qi, q := range body.Quiz.GetQuestions() {
					if len(q.GetOptions()) < 2 || len(q.GetCorrect()) == 0 {
						return r, invalid("%s, вопрос %d: нужны хотя бы два варианта и верный ответ", where(), qi+1)
					}
					for _, c := range q.GetCorrect() {
						if c < 0 || int(c) >= len(q.GetOptions()) {
							return r, invalid("%s, вопрос %d: верный ответ вне списка вариантов", where(), qi+1)
						}
					}
				}
			case *entity.ManualBlock_Literature:
				for _, id := range body.Literature.GetItemIds() {
					if id > 0 && !seenItem[id] {
						seenItem[id] = true
						r.items = append(r.items, id)
					}
				}
			}
		}
	}
	if blocks > maxBlocks {
		return r, invalid("слишком много блоков: %d, не больше %d", blocks, maxBlocks)
	}
	return r, nil
}

// literatureIDs — catalog entries the literature blocks point at, once each.
func literatureIDs(sections []*entity.ManualSection) []int64 {
	var out []int64
	seen := map[int64]bool{}
	for _, s := range sections {
		for _, b := range s.GetBlocks() {
			for _, id := range b.GetLiterature().GetItemIds() {
				if !seen[id] {
					seen[id] = true
					out = append(out, id)
				}
			}
		}
	}
	return out
}

// withStoredFiles replaces the file data the page sent with the registered
// one, so a block never shows a name or type the module did not store.
func withStoredFiles(sections []*entity.ManualSection, files map[int64]*File) {
	for _, s := range sections {
		for _, b := range s.GetBlocks() {
			switch body := b.GetBody().(type) {
			case *entity.ManualBlock_Figure:
				body.Figure.File = files[body.Figure.GetFile().GetId()].toProto()
			case *entity.ManualBlock_Attachment:
				body.Attachment.File = files[body.Attachment.GetFile().GetId()].toProto()
			}
		}
	}
}

func isWebURL(raw string) bool {
	u, err := url.Parse(strings.TrimSpace(raw))
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}
