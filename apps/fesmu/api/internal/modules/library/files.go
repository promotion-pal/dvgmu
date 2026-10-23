package library

import (
	"context"
	"path/filepath"
	"strings"

	"connectrpc.com/connect"

	filesenum "dvgmu/api/contract/gen/go/file/enum"
	filespb "dvgmu/api/contract/gen/go/file/service"
	"dvgmu/api/contract/gen/go/file/service/serviceconnect"
)

// Files is the files service client (filesserviceconnect.FilesServiceClient).
type Files = serviceconnect.FilesServiceClient

// What each kind of upload may be and how large.
const (
	maxBookBytes   = 200 << 20
	maxManualBytes = 25 << 20
)

var bookExtensions = map[string]bool{".pdf": true, ".epub": true, ".docx": true}

// store hands content to the files service under fileType (its folder) and
// returns what was stored.
func store(ctx context.Context, files Files, fileType filesenum.FileType, name string, content []byte) (*File, error) {
	if files == nil {
		return nil, newError(ErrFiles, "сервис файлов не настроен (PACKAGE_FILES)")
	}
	resp, err := files.FileUpload(ctx, connect.NewRequest(&filespb.FileUploadRequest{
		FileName: name,
		Type:     fileType,
		Content:  content,
	}))
	if err != nil {
		return nil, newError(ErrFiles, "файл не сохранён: %v", err)
	}
	if !resp.Msg.GetSuccess() || resp.Msg.GetFile().GetId() == 0 {
		msg := resp.Msg.GetMessage()
		if strings.Contains(msg, "mime type not allowed") {
			return nil, invalid("такой тип файла не принимается")
		}
		return nil, newError(ErrFiles, "файл не сохранён: %s", msg)
	}
	f := resp.Msg.GetFile()
	return &File{ID: f.GetId(), Name: f.GetFileName(), MimeType: f.GetMimeType(), Size: f.GetFileSize()}, nil
}

// load reads a stored file whole.
func load(ctx context.Context, files Files, id int64) ([]byte, error) {
	if files == nil {
		return nil, newError(ErrFiles, "сервис файлов не настроен (PACKAGE_FILES)")
	}
	stream, err := files.FileDownload(ctx, connect.NewRequest(&filespb.FileDownloadRequest{Id: id}))
	if err != nil {
		return nil, newError(ErrFiles, "файл не получен: %v", err)
	}
	defer stream.Close()
	var out []byte
	for stream.Receive() {
		out = append(out, stream.Msg().GetChunkContent()...)
	}
	if err := stream.Err(); err != nil {
		if connect.CodeOf(err) == connect.CodeNotFound {
			return nil, notFound("файл не найден")
		}
		return nil, newError(ErrFiles, "файл не получен: %v", err)
	}
	return out, nil
}

// checkUpload validates a file before it goes to the files service.
func checkUpload(name string, content []byte, max int64, extensions map[string]bool) error {
	if strings.TrimSpace(name) == "" || len(content) == 0 {
		return invalid("выберите файл")
	}
	if int64(len(content)) > max {
		return invalid("файл больше %d МБ", max>>20)
	}
	if extensions != nil && !extensions[strings.ToLower(filepath.Ext(name))] {
		return invalid("издание принимается в PDF, EPUB или DOCX")
	}
	return nil
}
