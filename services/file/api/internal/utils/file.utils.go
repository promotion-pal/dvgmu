package utils

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Storage struct {
	basePath string
	log      *slog.Logger
}

func NewStorage(basePath string, log *slog.Logger) *Storage {
	return &Storage{basePath: basePath, log: log}
}

func (s *Storage) Save(data io.Reader, fileName string, path ...string) (string, error) {
	now := time.Now()
	datePath := fmt.Sprintf("%d/%02d/%02d", now.Year(), now.Month(), now.Day())

	allFolderParts := append(path, datePath)
	relativeFolderPath := filepath.Join(allFolderParts...)

	fullFolderPath := filepath.Join(s.basePath, relativeFolderPath)

	if err := os.MkdirAll(fullFolderPath, 0755); err != nil {
		return "", fmt.Errorf("%w: %w", ErrCreateDirectories, err)
	}

	fullFilePath := filepath.Join(fullFolderPath, filepath.Base(fileName))

	dst, err := os.Create(fullFilePath)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrCreateFile, err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, data); err != nil {
		os.Remove(fullFilePath)
		return "", fmt.Errorf("%w: %w", ErrWriteData, err)
	}

	return fullFilePath, nil
}

func (s *Storage) Read(relativePath string) (io.ReadCloser, error) {
	fullPath := filepath.Join(s.basePath, relativePath)
	return os.Open(fullPath)
}

func (s *Storage) Delete(relativePath string) error {
	fullPath := filepath.Join(s.basePath, relativePath)
	if err := os.Remove(fullPath); err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return fmt.Errorf("%w: %w", ErrDeleteFile, err)
	}
	return nil
}

func (s *Storage) DeleteAll(relativePath string) error {
	fullPath := filepath.Join(s.basePath, relativePath)

	if err := os.Remove(fullPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("%w: %w", ErrDeleteFile, err)
	}

	dir := filepath.Dir(fullPath)
	for dir != s.basePath && dir != "." {
		if err := os.Remove(dir); err != nil {
			break
		}
		dir = filepath.Dir(dir)
	}

	return nil
}

func (s *Storage) Exists(relativePath string) (bool, error) {
	fullPath := filepath.Join(s.basePath, relativePath)
	_, err := os.Stat(fullPath)
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, fmt.Errorf("%w: %w", ErrCheckFileExists, err)
}

func (s *Storage) GetInfo(relativePath string) (os.FileInfo, error) {
	fullPath := filepath.Join(s.basePath, relativePath)
	stat, err := os.Stat(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("%w: %s", ErrFileNotFound, relativePath)
		}
		return nil, fmt.Errorf("%w: %w", ErrGetFileInfo, err)
	}
	return stat, nil
}

func (s *Storage) GetSize(relativePath string) (int64, error) {
	info, err := s.GetInfo(relativePath)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

func (s *Storage) GetMimeType(relativePath string) (string, error) {
	file, err := s.Read(relativePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	mimeType, err := s.DefinitionMimeType(file)
	if err != nil {
		return "", err
	}
	return mimeType, nil
}

var AllowedMimeTypes = map[string]bool{
	"image/jpeg":    true,
	"image/png":     true,
	"image/gif":     true,
	"image/webp":    true,
	"image/svg+xml": true,

	"application/pdf":      true,
	"application/epub+zip": true,
	"text/plain":           true,
	"application/msword":   true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,

	"application/zip":  true,
	"application/gzip": true,
}

func (s *Storage) IsAllowedMimeType(mimeType string) bool {
	return AllowedMimeTypes[mimeType]
}

func (s *Storage) DefinitionMimeType(reader io.Reader) (string, error) {
	buffer := make([]byte, 512)
	n, err := reader.Read(buffer)
	if err != nil && err != io.EOF {
		return "", fmt.Errorf("%w: %w", ErrReadFile, err)
	}
	if n == 0 {
		return "application/octet-stream", nil
	}
	return http.DetectContentType(buffer[:n]), nil
}

func (s *Storage) ValidateMimeType(reader io.Reader) (string, error) {
	mimeType, err := s.DefinitionMimeType(reader)
	if err != nil {
		return "", err
	}

	if !s.IsAllowedMimeType(mimeType) {
		return "", fmt.Errorf("%w: %s", ErrMimeTypeNotAllowed, mimeType)
	}

	return mimeType, nil
}

func (s *Storage) JoinPath(parts ...string) string {
	return filepath.Join(parts...)
}

func (s *Storage) RelativePath(fullPath string) (string, error) {
	rel, err := filepath.Rel(s.basePath, fullPath)
	if err != nil {
		return "", fmt.Errorf("%w: %w", ErrGetRelativePath, err)
	}
	return rel, nil
}

func (s *Storage) FullPath(relativePath string) string {
	return filepath.Join(s.basePath, relativePath)
}

func (s *Storage) CreateDir(relativePath string) error {
	fullPath := filepath.Join(s.basePath, relativePath)
	return os.MkdirAll(fullPath, 0755)
}

func (s *Storage) ListFiles(relativePath string) ([]string, error) {
	fullPath := filepath.Join(s.basePath, relativePath)
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, fmt.Errorf("%w: %w", ErrListFiles, err)
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() {
			files = append(files, entry.Name())
		}
	}
	return files, nil
}

func (s *Storage) ListAllFiles(relativePath string) ([]string, error) {
	fullPath := filepath.Join(s.basePath, relativePath)
	var files []string

	err := filepath.Walk(fullPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			rel, _ := filepath.Rel(s.basePath, path)
			files = append(files, rel)
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrWalkDirectory, err)
	}
	return files, nil
}

func (s *Storage) Copy(srcRelativePath, dstRelativePath string) error {
	srcFull := filepath.Join(s.basePath, srcRelativePath)
	dstFull := filepath.Join(s.basePath, dstRelativePath)

	if _, err := os.Stat(srcFull); err != nil {
		return fmt.Errorf("%w: %w", ErrSourceFileNotFound, err)
	}

	if err := os.MkdirAll(filepath.Dir(dstFull), 0755); err != nil {
		return fmt.Errorf("%w: %w", ErrCreateDestDir, err)
	}

	src, err := os.Open(srcFull)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrOpenSource, err)
	}
	defer src.Close()

	dst, err := os.Create(dstFull)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrCreateDest, err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("%w: %w", ErrCopyFile, err)
	}

	return nil
}

func (s *Storage) Move(srcRelativePath, dstRelativePath string) error {
	srcFull := filepath.Join(s.basePath, srcRelativePath)
	dstFull := filepath.Join(s.basePath, dstRelativePath)

	if err := os.MkdirAll(filepath.Dir(dstFull), 0755); err != nil {
		return fmt.Errorf("%w: %w", ErrCreateDestDir, err)
	}

	if err := os.Rename(srcFull, dstFull); err != nil {
		return fmt.Errorf("%w: %w", ErrMoveFile, err)
	}

	return nil
}

func SanitizeFileName(filename string) string {
	replacer := strings.NewReplacer(
		"..", "",
		"/", "",
		"\\", "",
		":", "",
		"*", "",
		"?", "",
		"\"", "",
		"<", "",
		">", "",
		"|", "",
	)
	return replacer.Replace(filename)
}

func GenerateDatePath() string {
	now := time.Now()
	return fmt.Sprintf("%d/%02d/%02d", now.Year(), now.Month(), now.Day())
}
