package utils

import "errors"

var (
	ErrCreateDirectories  = errors.New("failed to create directories")
	ErrCreateFile         = errors.New("failed to create file")
	ErrWriteData          = errors.New("failed to write data")
	ErrDeleteFile         = errors.New("failed to delete file")
	ErrCheckFileExists    = errors.New("failed to check file existence")
	ErrFileNotFound       = errors.New("file not found")
	ErrGetFileInfo        = errors.New("failed to get file info")
	ErrReadFile           = errors.New("failed to read file")
	ErrMimeTypeNotAllowed = errors.New("mime type not allowed")
	ErrGetRelativePath    = errors.New("failed to get relative path")
	ErrListFiles          = errors.New("failed to list files")
	ErrWalkDirectory      = errors.New("failed to walk directory")
	ErrSourceFileNotFound = errors.New("source file not found")
	ErrCreateDestDir      = errors.New("failed to create destination directory")
	ErrOpenSource         = errors.New("failed to open source file")
	ErrCreateDest         = errors.New("failed to create destination file")
	ErrCopyFile           = errors.New("failed to copy file")
	ErrMoveFile           = errors.New("failed to move file")

	ErrUnsupportedFileType     = errors.New("unsupported file type")
	ErrUnsupportedGenerateType = errors.New("unsupported generate type")
	ErrGetFile                 = errors.New("failed to get file")
)
