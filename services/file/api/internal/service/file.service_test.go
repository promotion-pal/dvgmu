package service

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"fesmu/contract/file/enum"
	"dvgmu/file/internal/domain/models"
	"dvgmu/file/internal/utils"
)

type memFiles struct{ saved []*models.File }

func (m *memFiles) FileCreate(_ context.Context, f *models.File) (int64, error) {
	m.saved = append(m.saved, f)
	f.ID = int64(len(m.saved))
	return f.ID, nil
}

func (m *memFiles) FileFetchByID(_ context.Context, id int64) (*models.File, error) {
	return m.saved[id-1], nil
}

func newTestService(t *testing.T) (*FileService, *memFiles, string) {
	t.Helper()
	base := t.TempDir()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	files := &memFiles{}
	return NewFileService(log, files, files, utils.NewStorage(base, log), nil, nil), files, base
}

func TestUploadStoresEachTypeInItsFolder(t *testing.T) {
	cases := []struct {
		fileType enum.FileType
		name     string
		content  []byte
		folder   string
		mime     string
	}{
		{enum.FileType_FILE_TYPE_LIBRARY_BOOK, "Анатомия.pdf", []byte("%PDF-1.7\n..."), "library/books", "application/pdf"},
		{enum.FileType_FILE_TYPE_LIBRARY_MANUAL, "схема.png", []byte("\x89PNG\r\n\x1a\n0000"), "library/manuals", "image/png"},
		{enum.FileType_FILE_TYPE_TEST_IMAGE, "показания ДП-5В.jpg", []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00"), "tests/images", "image/jpeg"},
	}
	for _, c := range cases {
		t.Run(c.folder, func(t *testing.T) {
			svc, files, base := newTestService(t)
			id, _, err := svc.Upload(context.Background(), 7, c.name, bytes.NewReader(c.content), c.fileType)
			if err != nil {
				t.Fatalf("upload: %v", err)
			}
			f := files.saved[id-1]
			if !strings.HasPrefix(f.RelativePath, c.folder+"/") {
				t.Errorf("path %q, want under %q", f.RelativePath, c.folder)
			}
			if f.MimeType != c.mime || f.FileName != c.name || f.Type != c.fileType || f.UserID != 7 {
				t.Errorf("record %+v", f)
			}
			got, err := os.ReadFile(filepath.Join(base, f.RelativePath))
			if err != nil || !bytes.Equal(got, c.content) {
				t.Errorf("content on disk: %q, %v", got, err)
			}
		})
	}
}

func TestUploadRejectsDisallowedContent(t *testing.T) {
	svc, files, _ := newTestService(t)
	_, _, err := svc.Upload(context.Background(), 1, "run.exe", bytes.NewReader([]byte("MZ\x90\x00\x03\x00\x00\x00")), enum.FileType_FILE_TYPE_LIBRARY_BOOK)
	if err == nil || len(files.saved) != 0 {
		t.Fatalf("err %v, saved %d", err, len(files.saved))
	}
}
