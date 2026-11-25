package library

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"connectrpc.com/connect"

	entity "fesmu/contract/fesmu/entity/v2"
	enum "fesmu/contract/fesmu/enum/v2"
	filesenum "fesmu/contract/file/enum"
	pb "fesmu/contract/fesmu/service/v2"
	"dvgmu/api/internal/auth"
)

// Service holds the module's use cases.
type Service struct {
	log   *slog.Logger
	store *storage
	files Files
	now   func() time.Time
}

func newService(log *slog.Logger, store *storage, files Files) *Service {
	return &Service{log: log, store: store, files: files, now: time.Now}
}

func (s *Service) ready() error {
	if s.store == nil {
		return ErrUnavailable
	}
	return nil
}

// ── Rights ────────────────────────────────────────────────────────────────

func signedIn(ctx context.Context) (*auth.User, error) {
	u, ok := auth.UserFromContext(ctx)
	if !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("войдите, чтобы работать с библиотекой"))
	}
	return u, nil
}

// requireCan пускает изменение только с правом на изменение раздела.
func requireCan(ctx context.Context, section auth.Section, what string) (*auth.User, error) {
	u, err := signedIn(ctx)
	if err != nil {
		return nil, err
	}
	if !u.Can(section, auth.ActionPost) {
		return nil, forbidden("нет права %s — нужен доступ %s, обратитесь к администратору", what, auth.Perm(section, auth.ActionPost))
	}
	return u, nil
}

func canEdit(ctx context.Context, section auth.Section) bool {
	u, ok := auth.UserFromContext(ctx)
	return ok && u.Can(section, auth.ActionPost)
}

// clean trims a typed field and checks its length in characters.
func clean(v, field string, max int, required bool) (string, error) {
	v = strings.TrimSpace(v)
	if required && v == "" {
		return "", invalid("заполните поле «%s»", field)
	}
	if utf8.RuneCountInString(v) > max {
		return "", invalid("поле «%s» длиннее %d символов", field, max)
	}
	return v, nil
}

// ── Catalog ───────────────────────────────────────────────────────────────

func (s *Service) Items(ctx context.Context, query, discipline string) ([]*entity.LibraryItem, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	list, err := s.store.items(ctx, query, strings.TrimSpace(discipline))
	if err != nil {
		return nil, err
	}
	out := make([]*entity.LibraryItem, len(list))
	for i, it := range list {
		out[i] = it.toProto()
	}
	return out, nil
}

func (s *Service) Item(ctx context.Context, id int64) (*entity.LibraryItem, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	it, err := s.store.item(ctx, id)
	if err != nil {
		return nil, err
	}
	return it.toProto(), nil
}

// fillItem copies the typed fields onto it, checking them.
func fillItem(it *Item, in *pb.LibraryItemInput) error {
	var err error
	switch in.GetKind() {
	case enum.LibraryItemKind_LIBRARY_ITEM_KIND_FILE, enum.LibraryItemKind_LIBRARY_ITEM_KIND_LINK:
	default:
		return invalid("выберите, файл это или ссылка")
	}
	if it.ID != 0 && it.Kind != in.GetKind() {
		return invalid("файл нельзя превратить в ссылку и наоборот — добавьте издание заново")
	}
	it.Kind = in.GetKind()
	if it.Title, err = clean(in.GetTitle(), "Название", 512, true); err != nil {
		return err
	}
	if it.Authors, err = clean(in.GetAuthors(), "Авторы", 512, false); err != nil {
		return err
	}
	if it.Publisher, err = clean(in.GetPublisher(), "Издательство", 255, false); err != nil {
		return err
	}
	if it.Description, err = clean(in.GetDescription(), "Описание", 8192, false); err != nil {
		return err
	}
	if it.Discipline, err = clean(in.GetDiscipline(), "Дисциплина", 255, false); err != nil {
		return err
	}
	if y := in.GetYear(); y != 0 && (y < 1800 || y > 2100) {
		return invalid("год издания — четыре цифры")
	}
	it.Year = in.GetYear()
	it.URL = ""
	if it.Kind == enum.LibraryItemKind_LIBRARY_ITEM_KIND_LINK {
		if !isWebURL(in.GetUrl()) {
			return invalid("ссылка должна начинаться с http:// или https://")
		}
		it.URL = strings.TrimSpace(in.GetUrl())
	}
	return nil
}

// storeBook sends an edition to library/books and registers it.
func (s *Service) storeBook(ctx context.Context, by, name string, content []byte) (*File, error) {
	if err := checkUpload(name, content, maxBookBytes, bookExtensions); err != nil {
		return nil, err
	}
	f, err := store(ctx, s.files, filesenum.FileType_FILE_TYPE_LIBRARY_BOOK, name, content)
	if err != nil {
		return nil, err
	}
	f.CreatedBy, f.CreatedAt = by, s.now()
	if err := s.store.fileCreate(ctx, f); err != nil {
		return nil, err
	}
	return f, nil
}

func (s *Service) ItemCreate(ctx context.Context, in *pb.LibraryItemInput, fileName string, content []byte) (int64, error) {
	if err := s.ready(); err != nil {
		return 0, err
	}
	u, err := requireCan(ctx, auth.SectionLibrary, "добавлять издания")
	if err != nil {
		return 0, err
	}
	it := &Item{}
	if err := fillItem(it, in); err != nil {
		return 0, err
	}
	if it.Kind == enum.LibraryItemKind_LIBRARY_ITEM_KIND_FILE {
		f, err := s.storeBook(ctx, u.Username, fileName, content)
		if err != nil {
			return 0, err
		}
		it.FileID = &f.ID
	}
	it.CreatedBy = u.Username
	if err := s.store.itemSave(ctx, it); err != nil {
		return 0, err
	}
	return it.ID, nil
}

func (s *Service) ItemUpdate(ctx context.Context, id int64, in *pb.LibraryItemInput, fileName string, content []byte) error {
	if err := s.ready(); err != nil {
		return err
	}
	u, err := requireCan(ctx, auth.SectionLibrary, "править издания")
	if err != nil {
		return err
	}
	it, err := s.store.item(ctx, id)
	if err != nil {
		return err
	}
	if err := fillItem(it, in); err != nil {
		return err
	}
	if it.Kind == enum.LibraryItemKind_LIBRARY_ITEM_KIND_FILE && len(content) > 0 {
		f, err := s.storeBook(ctx, u.Username, fileName, content)
		if err != nil {
			return err
		}
		if it.FileID != nil {
			if err := s.store.fileDelete(ctx, *it.FileID); err != nil {
				return err
			}
		}
		it.FileID = &f.ID
	}
	if it.Kind == enum.LibraryItemKind_LIBRARY_ITEM_KIND_FILE && it.FileID == nil {
		return invalid("выберите файл издания")
	}
	return s.store.itemSave(ctx, it)
}

// ItemDelete removes the entry and unregisters its file (the files service
// keeps the bytes; nothing hands them out any more).
func (s *Service) ItemDelete(ctx context.Context, id int64) error {
	if err := s.ready(); err != nil {
		return err
	}
	if _, err := requireCan(ctx, auth.SectionLibrary, "удалять издания"); err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		it, err := tx.item(ctx, id)
		if err != nil {
			return err
		}
		if err := tx.itemDelete(ctx, id); err != nil {
			return err
		}
		if it.FileID != nil {
			return tx.fileDelete(ctx, *it.FileID)
		}
		return nil
	})
}

func (s *Service) Disciplines(ctx context.Context) ([]string, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	return s.store.disciplines(ctx)
}

// ── Files ─────────────────────────────────────────────────────────────────

// FileUpload stores a manual's figure or attachment in library/manuals.
func (s *Service) FileUpload(ctx context.Context, name string, content []byte) (*entity.LibraryFile, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	u, err := requireCan(ctx, auth.SectionManuals, "загружать файлы методичек")
	if err != nil {
		return nil, err
	}
	if err := checkUpload(name, content, maxManualBytes, nil); err != nil {
		return nil, err
	}
	f, err := store(ctx, s.files, filesenum.FileType_FILE_TYPE_LIBRARY_MANUAL, name, content)
	if err != nil {
		return nil, err
	}
	f.CreatedBy, f.CreatedAt = u.Username, s.now()
	if err := s.store.fileCreate(ctx, f); err != nil {
		return nil, err
	}
	return f.toProto(), nil
}

// FileFetch hands out a file the module registered, and only such; an
// anonymous visitor gets only a figure or attachment of a published manual.
func (s *Service) FileFetch(ctx context.Context, id int64) (*entity.LibraryFile, []byte, error) {
	if err := s.ready(); err != nil {
		return nil, nil, err
	}
	if _, ok := auth.UserFromContext(ctx); !ok {
		published, err := s.store.inPublishedManual(ctx, id)
		if err != nil {
			return nil, nil, err
		}
		if !published {
			return nil, nil, connect.NewError(connect.CodeUnauthenticated, errors.New("войдите, чтобы открыть этот файл"))
		}
	}
	f, err := s.store.file(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	content, err := load(ctx, s.files, id)
	if err != nil {
		return nil, nil, err
	}
	return f.toProto(), content, nil
}

// ── Manuals ───────────────────────────────────────────────────────────────

func (s *Service) Manuals(ctx context.Context, discipline, query string) ([]*entity.Manual, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	editor := canEdit(ctx, auth.SectionManuals)
	list, err := s.store.manuals(ctx, strings.TrimSpace(discipline), query, !editor)
	if err != nil {
		return nil, err
	}
	out := make([]*entity.Manual, len(list))
	for i, m := range list {
		out[i] = m.toProto(editor)
	}
	return out, nil
}

// Manual returns a manual with its sections and the literature they cite:
// the published version, or the draft for editors.
func (s *Service) Manual(ctx context.Context, id int64, draft bool) (*entity.Manual, []*entity.LibraryItem, error) {
	if err := s.ready(); err != nil {
		return nil, nil, err
	}
	if draft {
		if _, err := requireCan(ctx, auth.SectionManuals, "открывать черновики методичек"); err != nil {
			return nil, nil, err
		}
	}
	m, err := s.store.manual(ctx, id)
	if err != nil {
		return nil, nil, err
	}
	raw := m.Draft
	if !draft {
		if m.Status != enum.ManualStatus_MANUAL_STATUS_PUBLISHED {
			return nil, nil, notFound("методичка не опубликована")
		}
		raw = m.Published
	}
	sections, err := decodeSections(raw)
	if err != nil {
		return nil, nil, err
	}
	out := m.toProto(canEdit(ctx, auth.SectionManuals))
	out.Sections = sections

	items, err := s.store.itemsByID(ctx, literatureIDs(sections))
	if err != nil {
		return nil, nil, err
	}
	literature := make([]*entity.LibraryItem, len(items))
	for i, it := range items {
		literature[i] = it.toProto()
	}
	return out, literature, nil
}

// fillManual copies the card fields onto m, checking them.
func fillManual(m *Manual, in *pb.ManualInput) error {
	var err error
	if m.Discipline, err = clean(in.GetDiscipline(), "Дисциплина", 255, true); err != nil {
		return err
	}
	if m.Title, err = clean(in.GetTitle(), "Название", 512, true); err != nil {
		return err
	}
	if m.Specialty, err = clean(in.GetSpecialty(), "Специальность", 255, false); err != nil {
		return err
	}
	if m.Authors, err = clean(in.GetAuthors(), "Авторы", 512, false); err != nil {
		return err
	}
	if m.Annotation, err = clean(in.GetAnnotation(), "Аннотация", 4096, false); err != nil {
		return err
	}
	if c := in.GetCourse(); c < 0 || c > 6 {
		return invalid("курс — от 1 до 6")
	}
	if sem := in.GetSemester(); sem < 0 || sem > 12 {
		return invalid("семестр — от 1 до 12")
	}
	m.Course, m.Semester = in.GetCourse(), in.GetSemester()
	return nil
}

func (s *Service) ManualCreate(ctx context.Context, in *pb.ManualInput) (int64, error) {
	if err := s.ready(); err != nil {
		return 0, err
	}
	u, err := requireCan(ctx, auth.SectionManuals, "создавать методички")
	if err != nil {
		return 0, err
	}
	m := &Manual{Status: enum.ManualStatus_MANUAL_STATUS_DRAFT, UpdatedBy: u.Username}
	if err := fillManual(m, in); err != nil {
		return 0, err
	}
	if m.Draft, err = encodeSections(nil); err != nil {
		return 0, err
	}
	if err := s.store.manualSave(ctx, m); err != nil {
		return 0, err
	}
	return m.ID, nil
}

// ManualUpdate saves the draft: the card and the sections.
func (s *Service) ManualUpdate(ctx context.Context, id int64, in *pb.ManualInput, sections []*entity.ManualSection) error {
	if err := s.ready(); err != nil {
		return err
	}
	u, err := requireCan(ctx, auth.SectionManuals, "править методички")
	if err != nil {
		return err
	}
	r, err := checkSections(sections)
	if err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		files, err := tx.filesByID(ctx, r.files)
		if err != nil {
			return err
		}
		for _, id := range r.files {
			if files[id] == nil {
				return invalid("файл %d не загружен через библиотеку — загрузите его заново", id)
			}
		}
		items, err := tx.existingItemIDs(ctx, r.items)
		if err != nil {
			return err
		}
		for _, id := range r.items {
			if !items[id] {
				return invalid("издания %d больше нет в каталоге — уберите его из списка литературы", id)
			}
		}
		withStoredFiles(sections, files)

		m, err := tx.manualLocked(ctx, id)
		if err != nil {
			return err
		}
		if err := fillManual(m, in); err != nil {
			return err
		}
		draft, err := encodeSections(sections)
		if err != nil {
			return err
		}
		if len(draft) > maxContentBytes {
			return invalid("методичка слишком большая — разделите её на несколько")
		}
		m.Draft = draft
		m.DraftChanged = m.Status == enum.ManualStatus_MANUAL_STATUS_DRAFT || !sameJSON(m.Draft, m.Published)
		m.UpdatedBy = u.Username
		return tx.manualSave(ctx, m)
	})
}

func (s *Service) ManualPublish(ctx context.Context, id int64) error {
	if err := s.ready(); err != nil {
		return err
	}
	u, err := requireCan(ctx, auth.SectionManuals, "публиковать методички")
	if err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		m, err := tx.manualLocked(ctx, id)
		if err != nil {
			return err
		}
		sections, err := decodeSections(m.Draft)
		if err != nil {
			return err
		}
		if len(sections) == 0 {
			return invalid("в методичке нет ни одной темы — публиковать нечего")
		}
		now := s.now()
		m.Published = m.Draft
		m.Status = enum.ManualStatus_MANUAL_STATUS_PUBLISHED
		m.DraftChanged = false
		m.PublishedAt = &now
		m.UpdatedBy = u.Username
		return tx.manualSave(ctx, m)
	})
}

func (s *Service) ManualArchive(ctx context.Context, id int64) error {
	if err := s.ready(); err != nil {
		return err
	}
	u, err := requireCan(ctx, auth.SectionManuals, "снимать методички с публикации")
	if err != nil {
		return err
	}
	return s.store.tx(ctx, func(tx *storage) error {
		m, err := tx.manualLocked(ctx, id)
		if err != nil {
			return err
		}
		if m.Status != enum.ManualStatus_MANUAL_STATUS_PUBLISHED {
			return invalid("методичка не опубликована")
		}
		m.Status = enum.ManualStatus_MANUAL_STATUS_ARCHIVED
		m.UpdatedBy = u.Username
		return tx.manualSave(ctx, m)
	})
}

func (s *Service) ManualDelete(ctx context.Context, id int64) error {
	if err := s.ready(); err != nil {
		return err
	}
	if _, err := requireCan(ctx, auth.SectionManuals, "удалять методички"); err != nil {
		return err
	}
	if _, err := s.store.manual(ctx, id); err != nil {
		return err
	}
	return s.store.manualDelete(ctx, id)
}

// sameJSON compares stored versions; protojson output is stable for equal
// messages within one build, which is all a draft/published pair needs.
func sameJSON(a, b []byte) bool { return string(a) == string(b) }

// ── Reader ────────────────────────────────────────────────────────────────

const recentProgress = 10

func (s *Service) Progress(ctx context.Context, kind enum.ReaderSourceKind, refID int64) ([]*entity.ReaderProgress, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	u, err := signedIn(ctx)
	if err != nil {
		return nil, err
	}
	list, err := s.store.progress(ctx, u.UUID, kind, refID, recentProgress)
	if err != nil {
		return nil, err
	}
	ids := map[enum.ReaderSourceKind][]int64{}
	for _, p := range list {
		ids[p.Kind] = append(ids[p.Kind], p.RefID)
	}
	titles := map[enum.ReaderSourceKind]map[int64]string{}
	for k, refs := range ids {
		if titles[k], err = s.store.titles(ctx, k, refs); err != nil {
			return nil, err
		}
	}
	out := make([]*entity.ReaderProgress, 0, len(list))
	for _, p := range list {
		title, ok := titles[p.Kind][p.RefID]
		if !ok {
			continue // the edition or manual is gone
		}
		out = append(out, &entity.ReaderProgress{
			Kind: p.Kind, RefId: p.RefID, Position: p.Position, Percent: p.Percent,
			Title: title, UpdatedAt: timestamp(p.UpdatedAt),
		})
	}
	return out, nil
}

func (s *Service) ProgressSave(ctx context.Context, kind enum.ReaderSourceKind, refID int64, position string, percent int32) error {
	if err := s.ready(); err != nil {
		return err
	}
	u, err := signedIn(ctx)
	if err != nil {
		return err
	}
	switch kind {
	case enum.ReaderSourceKind_READER_SOURCE_KIND_ITEM, enum.ReaderSourceKind_READER_SOURCE_KIND_MANUAL:
	default:
		return invalid("неизвестно, что открыто в читалке")
	}
	if refID <= 0 {
		return invalid("неизвестно, что открыто в читалке")
	}
	if len(position) > 255 {
		return invalid("слишком длинная позиция")
	}
	percent = min(max(percent, 0), 100)
	return s.store.progressSave(ctx, &Progress{
		UserUUID: u.UUID, Kind: kind, RefID: refID,
		Position: position, Percent: percent, UpdatedAt: s.now(),
	})
}
