package service

import (
	"context"
	"errors"
	"fmt"

	"connectrpc.com/connect"

	filesenum "dvgmu/api/contract/gen/go/file/enum"
	filespb "dvgmu/api/contract/gen/go/file/service"
	"dvgmu/api/contract/gen/go/file/service/serviceconnect"
)

// testImageFiles keeps the tests' pictures in the files service, in their own
// folder (FILE_TYPE_TEST_IMAGE → tests/images).
type testImageFiles struct {
	client serviceconnect.FilesServiceClient
}

// NewTestImageFiles: nil client — no files service configured, no pictures.
func NewTestImageFiles(client serviceconnect.FilesServiceClient) TestImageFiles {
	if client == nil {
		return nil
	}
	return testImageFiles{client: client}
}

func (f testImageFiles) Store(ctx context.Context, name string, content []byte) (int64, error) {
	resp, err := f.client.FileUpload(ctx, connect.NewRequest(&filespb.FileUploadRequest{
		FileName: name,
		Type:     filesenum.FileType_FILE_TYPE_TEST_IMAGE,
		Content:  content,
	}))
	if err != nil {
		return 0, fmt.Errorf("картинка не сохранена в сервисе файлов: %w", err)
	}
	if !resp.Msg.GetSuccess() || resp.Msg.GetFile().GetId() == 0 {
		return 0, fmt.Errorf("картинка не сохранена в сервисе файлов: %s", resp.Msg.GetMessage())
	}
	return resp.Msg.GetFile().GetId(), nil
}

func (f testImageFiles) Load(ctx context.Context, fileID int64) ([]byte, error) {
	stream, err := f.client.FileDownload(ctx, connect.NewRequest(&filespb.FileDownloadRequest{Id: fileID}))
	if err != nil {
		return nil, fmt.Errorf("картинка не получена из сервиса файлов: %w", err)
	}
	defer stream.Close()
	var out []byte
	for stream.Receive() {
		out = append(out, stream.Msg().GetChunkContent()...)
	}
	if err := stream.Err(); err != nil {
		return nil, fmt.Errorf("картинка не получена из сервиса файлов: %w", err)
	}
	if len(out) == 0 {
		return nil, errors.New("сервис файлов вернул пустую картинку")
	}
	return out, nil
}
