package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"fesmu/contract/file/enum"
	mdmentity "fesmu/contract/mdm/entity"
	"dvgmu/file/internal/domain/models"
	"dvgmu/file/internal/utils"
	"dvgmu/file/internal/utils/excel"
	"dvgmu/file/internal/utils/word"
)

type FileService struct {
	log         *slog.Logger
	saver       FileSaver
	provider    FileProvider
	storage     *utils.Storage
	excelParser *excel.Parser
	wordGen     *word.Generator
}

type FileSaver interface {
	FileCreate(ctx context.Context, file *models.File) (int64, error)
}

type FileProvider interface {
	FileFetchByID(ctx context.Context, id int64) (*models.File, error)
}

func NewFileService(
	log *slog.Logger,
	saver FileSaver,
	provider FileProvider,
	storage *utils.Storage,
	excelParser *excel.Parser,
	wordGen *word.Generator,
) *FileService {
	return &FileService{
		log:         log,
		provider:    provider,
		saver:       saver,
		storage:     storage,
		excelParser: excelParser,
		wordGen:     wordGen,
	}
}

func (s *FileService) Upload(
	ctx context.Context,
	userId int64,
	fileName string,
	fileContent io.Reader,
	fileType enum.FileType,
) (int64, any, error) {
	s.log.Info("Starting file upload processing",
		slog.Int64("user_id", userId),
		slog.String("file_name", fileName),
	)

	switch fileType {
	case enum.FileType_FILE_TYPE_EXCEL_PARSER_USER:
		parsedUsers, err := s.excelParser.FileExcelUserParser(fileContent)
		if err != nil {
			s.log.Error("failed to parse users from excel file", slog.String("error", err.Error()))
			return 0, nil, fmt.Errorf("%w: %w", excel.ErrParseExcelUsers, err)
		}
		s.log.Info("parsed users from excel file", slog.Int("count", len(parsedUsers)))
		return 0, parsedUsers, nil

	case enum.FileType_FILE_TYPE_EXCEL_PARSER_STUDENT:
		parsedStudents, err := s.excelParser.FileExcelStudentParser(fileContent)
		if err != nil {
			s.log.Error("failed to parse students from excel file", slog.String("error", err.Error()))
			return 0, nil, fmt.Errorf("%w: %w", excel.ErrParseExcelStudents, err)
		}
		s.log.Info("parsed students from excel file", slog.Int("count", len(parsedStudents)))
		return 0, parsedStudents, nil
	}

	if folder, ok := storedFolders[fileType]; ok {
		id, err := s.store(ctx, userId, fileName, fileContent, fileType, folder)
		if err != nil {
			s.log.Error("failed to store file", slog.String("type", fileType.String()), slog.String("error", err.Error()))
			return 0, nil, err
		}
		return id, nil, nil
	}

	return 0, nil, fmt.Errorf("%w: %v", utils.ErrUnsupportedFileType, fileType)
}

// storedFolders — the upload types that are kept, and the folder under
// storage.base_path each is saved to (then year/month/day).
var storedFolders = map[enum.FileType]string{
	enum.FileType_FILE_TYPE_LIBRARY_BOOK:   "library/books",
	enum.FileType_FILE_TYPE_LIBRARY_MANUAL: "library/manuals",
	enum.FileType_FILE_TYPE_TEST_IMAGE:     "tests/images",
}

// store saves the file to its type's folder and records it; the name on disk
// gets a timestamp prefix so two uploads of one name on one day both survive.
func (s *FileService) store(
	ctx context.Context,
	userId int64,
	fileName string,
	fileContent io.Reader,
	fileType enum.FileType,
	folder string,
) (int64, error) {
	content, err := io.ReadAll(fileContent)
	if err != nil {
		return 0, fmt.Errorf("%w: %w", utils.ErrReadFile, err)
	}
	if len(content) == 0 {
		return 0, fmt.Errorf("%w: empty file", utils.ErrReadFile)
	}

	name := utils.SanitizeFileName(filepath.Base(fileName))
	if name == "" {
		name = "file"
	}
	mimeType := detectMimeType(content, name)
	if !s.storage.IsAllowedMimeType(mimeType) {
		return 0, fmt.Errorf("%w: %s", utils.ErrMimeTypeNotAllowed, mimeType)
	}

	diskName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), name)
	fullPath, err := s.storage.Save(bytes.NewReader(content), diskName, folder)
	if err != nil {
		return 0, err
	}
	relativePath, err := s.storage.RelativePath(fullPath)
	if err != nil {
		return 0, err
	}

	id, err := s.saver.FileCreate(ctx, &models.File{
		UserID:       userId,
		FileSize:     int64(len(content)),
		FileName:     name,
		RelativePath: relativePath,
		MimeType:     mimeType,
		Type:         fileType,
	})
	if err != nil {
		_ = s.storage.Delete(relativePath)
		return 0, err
	}
	s.log.Info("file stored", slog.Int64("id", id), slog.String("path", relativePath), slog.String("mime", mimeType))
	return id, nil
}

// detectMimeType sniffs the content, without parameters ("; charset=…").
// Sniffing sees SVG as XML and EPUB as a ZIP, so those go by the extension.
func detectMimeType(content []byte, name string) string {
	mimeType, _, err := mime.ParseMediaType(http.DetectContentType(content))
	if err != nil {
		mimeType = "application/octet-stream"
	}
	switch ext := strings.ToLower(filepath.Ext(name)); {
	case ext == ".svg" && (mimeType == "text/xml" || mimeType == "text/plain"):
		return "image/svg+xml"
	case ext == ".epub" && mimeType == "application/zip":
		return "application/epub+zip"
	case ext == ".docx" && mimeType == "application/zip":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	}
	return mimeType
}

func (s *FileService) Download(ctx context.Context, id int64) (*models.File, error) {
	file, err := s.provider.FileFetchByID(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", utils.ErrGetFile, err)
	}
	return file, nil
}

// Generate is the single entry point for document generation: genType picks
// the template, params carries that document's extra data (the concrete type
// each case expects is noted below). Returns the file name and content.
func (s *FileService) Generate(
	ctx context.Context,
	profile *mdmentity.UserFull,
	genType enum.FileGenerateType,
	params any,
) (string, []byte, error) {
	var (
		fileName string
		content  []byte
		err      error
	)

	switch genType {
	case enum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_DORMITORY:
		p, ok := params.(word.DormitoryApplicationParams)
		if !ok {
			return "", nil, word.ErrDormitoryParams
		}
		fileName = "application_dormitory.docx"
		content, err = s.wordGen.ApplicationDormitoryStudent(profile, p)

	case enum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_DORMITORY_STUDENT_FULL:
		p, ok := params.(word.DormitoryApplicationParams)
		if !ok {
			return "", nil, word.ErrDormitoryParams
		}
		fileName = "application_dormitory_student_full.docx"
		content, err = s.wordGen.ApplicationDormitoryStudentFull(profile, p)

	case enum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_DORMITORY_ABITUR:
		p, ok := params.(word.DormitoryApplicationParams)
		if !ok {
			return "", nil, word.ErrDormitoryParams
		}
		fileName = "application_dormitory_abitur.docx"
		content, err = s.wordGen.ApplicationDormitoryAbitur(profile, p)

	case enum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_TEMPORARY_RESIDENCE:
		p, ok := params.(word.TemporaryResidenceParams)
		if !ok {
			return "", nil, word.ErrTemporaryResidenceParams
		}
		fileName = "application_temporary_residence.docx"
		content, err = s.wordGen.ApplicationTemporaryResidence(profile, p)

	case enum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_MILITARY_REGISTRATION_CARD:
		fileName = "military_registration_card.docx"
		content, err = s.wordGen.MilitaryRegistrationCard(profile)

	case enum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_STUDY_CERTIFICATE:
		fileName = "study_certificate.docx"
		content, err = s.wordGen.StudyCertificate(profile)

	case enum.FileGenerateType_FILE_GENERATE_TYPE_WORD_GEN_APPLICATION_CERTIFICATE_ENROLLMENT:
		fileName = "application_certificate_enrollment.docx"
		content, err = s.wordGen.ApplicationCertificateEnrollment(profile)

	default:
		return "", nil, fmt.Errorf("%w: %v", utils.ErrUnsupportedGenerateType, genType)
	}

	if err != nil {
		s.log.Error("failed to generate document", slog.String("type", genType.String()), slog.String("error", err.Error()))
		return "", nil, fmt.Errorf("%w: %w", word.ErrGenerateDocument, err)
	}
	return fileName, content, nil
}
