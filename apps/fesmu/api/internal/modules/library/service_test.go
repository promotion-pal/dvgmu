package library

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"

	"connectrpc.com/connect"
	"github.com/pressly/goose/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"dvgmu/api"
	entity "fesmu/contract/fesmu/entity/v2"
	enum "fesmu/contract/fesmu/enum/v2"
	filesentity "fesmu/contract/file/entity"
	filesenum "fesmu/contract/file/enum"
	filespb "fesmu/contract/file/service"
	"fesmu/contract/file/service/serviceconnect"
	pb "fesmu/contract/fesmu/service/v2"
	"dvgmu/api/internal/auth"
)

// fakeFiles stores uploads in memory and remembers each one's type.
type fakeFiles struct {
	serviceconnect.UnimplementedFilesServiceHandler
	types []filesenum.FileType
}

func (f *fakeFiles) FileUpload(_ context.Context, req *connect.Request[filespb.FileUploadRequest]) (*connect.Response[filespb.FileUploadResponse], error) {
	f.types = append(f.types, req.Msg.GetType())
	return connect.NewResponse(&filespb.FileUploadResponse{Success: true, File: &filesentity.File{
		Id: int64(100 + len(f.types)), FileName: req.Msg.GetFileName(), FileSize: int64(len(req.Msg.GetContent())), MimeType: "application/pdf",
	}}), nil
}

func (f *fakeFiles) FileGenerate(context.Context, *connect.Request[filespb.FileGenerateRequest]) (*connect.Response[filespb.FileGenerateResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, nil)
}

func (f *fakeFiles) FileDownload(context.Context, *connect.Request[filespb.FileDownloadRequest]) (*connect.ServerStreamForClient[filespb.FileDownloadResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, nil)
}

// newTestService runs the library migrations on an empty database given by
// LIBRARY_TEST_DSN, e.g. a throwaway container:
//
//	docker run --rm -d -p 55433:5432 -e POSTGRES_PASSWORD=pass postgres:17
//	LIBRARY_TEST_DSN="host=localhost port=55433 user=postgres password=pass dbname=postgres sslmode=disable" go test ./internal/modules/library/
func newTestService(t *testing.T) (*Service, *fakeFiles) {
	dsn := os.Getenv("LIBRARY_TEST_DSN")
	if dsn == "" {
		t.Skip("LIBRARY_TEST_DSN is not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	goose.SetBaseFS(api.MigrationsFS)
	if err := goose.SetDialect("postgres"); err != nil {
		t.Fatal(err)
	}
	if _, err := sqlDB.Exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public"); err != nil {
		t.Fatal(err)
	}
	if err := goose.Up(sqlDB, "migrations/library"); err != nil {
		t.Fatal(err)
	}
	files := &fakeFiles{}
	return newService(slog.New(slog.NewTextHandler(io.Discard, nil)), &storage{db: db}, files), files
}

func as(perms ...string) context.Context {
	return auth.WithUser(context.Background(), &auth.User{UUID: "u-" + perms[0], Username: perms[0], Permissions: perms[1:]})
}

func TestLibraryEndToEnd(t *testing.T) {
	s, files := newTestService(t)
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	librarian := as("librarian", "library.post")
	teacher := as("teacher", "manuals.post")
	student := as("student")

	// The catalog: only library.post adds; the file goes to library/books.
	book := &pb.LibraryItemInput{Kind: enum.LibraryItemKind_LIBRARY_ITEM_KIND_FILE, Title: "Анатомия человека", Discipline: "Анатомия"}
	if _, err := s.ItemCreate(student, book, "a.pdf", []byte("%PDF")); !errors.Is(err, ErrForbidden) {
		t.Fatalf("student adds a book: %v", err)
	}
	if _, err := s.ItemCreate(librarian, book, "a.exe", []byte("MZ")); !errors.Is(err, ErrInvalid) {
		t.Fatalf("exe accepted: %v", err)
	}
	bookID, err := s.ItemCreate(librarian, book, "a.pdf", []byte("%PDF"))
	must(err)
	if files.types[0] != filesenum.FileType_FILE_TYPE_LIBRARY_BOOK {
		t.Errorf("book stored as %v", files.types[0])
	}
	items, err := s.Items(student, "анатом", "")
	must(err)
	if len(items) != 1 || items[0].GetFile().GetName() != "a.pdf" {
		t.Fatalf("search: %v", items)
	}

	// A manual: the teacher writes the draft, students see nothing until it is published.
	id, err := s.ManualCreate(teacher, &pb.ManualInput{Discipline: "Анатомия", Title: "Остеология", Course: 1})
	must(err)
	figure, err := s.FileUpload(teacher, "scheme.png", []byte("png"))
	must(err)
	if files.types[1] != filesenum.FileType_FILE_TYPE_LIBRARY_MANUAL {
		t.Errorf("manual file stored as %v", files.types[1])
	}
	sections := []*entity.ManualSection{{Id: "s1", Title: "Кости черепа", Blocks: []*entity.ManualBlock{
		text("b1", "Череп состоит из **23** костей."),
		{Id: "b2", Body: &entity.ManualBlock_Figure{Figure: &entity.ManualFigureBlock{File: &entity.LibraryFile{Id: figure.GetId(), Name: "подмена.exe"}}}},
		{Id: "b3", Body: &entity.ManualBlock_Literature{Literature: &entity.ManualLiteratureBlock{ItemIds: []int64{bookID}}}},
	}}}
	in := &pb.ManualInput{Discipline: "Анатомия", Title: "Остеология", Course: 1}
	must(s.ManualUpdate(teacher, id, in, sections))

	if list, _ := s.Manuals(student, "", ""); len(list) != 0 {
		t.Fatalf("student sees a draft: %v", list)
	}
	if _, _, err := s.Manual(student, id, false); !errors.Is(err, ErrNotFound) {
		t.Fatalf("student opens a draft: %v", err)
	}
	if _, _, err := s.Manual(student, id, true); !errors.Is(err, ErrForbidden) {
		t.Fatalf("student asks for the draft: %v", err)
	}

	must(s.ManualPublish(teacher, id))
	m, literature, err := s.Manual(student, id, false)
	must(err)
	if len(m.GetSections()) != 1 || len(literature) != 1 || literature[0].GetId() != bookID {
		t.Fatalf("published: %v %v", m, literature)
	}
	if name := m.GetSections()[0].GetBlocks()[1].GetFigure().GetFile().GetName(); name != "scheme.png" {
		t.Errorf("figure file name %q, want the stored one", name)
	}

	// Without a sign-in (the /manuals page): published manuals and their
	// figures, but not the catalog's files. The fake files service cannot
	// download, so a passed check ends in ErrFiles, a refused one in
	// Unauthenticated.
	anonymous := context.Background()
	if list, _ := s.Manuals(anonymous, "", ""); len(list) != 1 {
		t.Fatalf("anonymous list: %v", list)
	}
	if _, _, err := s.Manual(anonymous, id, false); err != nil {
		t.Fatalf("anonymous reads a published manual: %v", err)
	}
	if _, _, err := s.FileFetch(anonymous, figure.GetId()); !errors.Is(err, ErrFiles) {
		t.Fatalf("anonymous fetches a published figure: %v", err)
	}
	if _, _, err := s.FileFetch(anonymous, items[0].GetFile().GetId()); connect.CodeOf(err) != connect.CodeUnauthenticated {
		t.Fatalf("anonymous fetches a catalog book: %v", err)
	}

	// Editing after publishing changes only the draft.
	sections[0].Blocks = sections[0].Blocks[:1]
	must(s.ManualUpdate(teacher, id, in, sections))
	m, _, _ = s.Manual(student, id, false)
	if len(m.GetSections()[0].GetBlocks()) != 3 {
		t.Errorf("students see the unpublished edit")
	}
	if list, _ := s.Manuals(teacher, "", ""); !list[0].GetDraftChanged() {
		t.Errorf("draft change not marked")
	}

	// A file the module did not store cannot be put into a manual.
	sections[0].Blocks = append(sections[0].Blocks, &entity.ManualBlock{Id: "b9", Body: &entity.ManualBlock_Attachment{Attachment: &entity.ManualAttachmentBlock{File: &entity.LibraryFile{Id: 999}}}})
	if err := s.ManualUpdate(teacher, id, in, sections); !errors.Is(err, ErrInvalid) {
		t.Fatalf("foreign file accepted: %v", err)
	}
	if _, _, err := s.FileFetch(student, 999); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign file handed out: %v", err)
	}

	// Reading positions are per user.
	must(s.ProgressSave(student, enum.ReaderSourceKind_READER_SOURCE_KIND_MANUAL, id, "block:b1", 40))
	must(s.ProgressSave(student, enum.ReaderSourceKind_READER_SOURCE_KIND_MANUAL, id, "block:b2", 150))
	recent, err := s.Progress(student, 0, 0)
	must(err)
	if len(recent) != 1 || recent[0].GetPercent() != 100 || recent[0].GetTitle() != "Остеология" {
		t.Fatalf("progress: %v", recent)
	}
	if other, _ := s.Progress(teacher, 0, 0); len(other) != 0 {
		t.Fatalf("someone else's progress: %v", other)
	}

	must(s.ManualArchive(teacher, id))
	if list, _ := s.Manuals(student, "", ""); len(list) != 0 {
		t.Errorf("archived manual listed for students")
	}
	disciplines, err := s.Disciplines(student)
	must(err)
	if len(disciplines) != 1 || disciplines[0] != "Анатомия" {
		t.Errorf("disciplines %v", disciplines)
	}
	must(s.ItemDelete(librarian, bookID))
}
