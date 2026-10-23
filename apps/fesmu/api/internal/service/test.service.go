package service

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"path/filepath"
	"strings"
	"time"

	enum "fesmu/contract/fesmu/enum/v1"
	"dvgmu/api/internal/domain/models"
	"dvgmu/api/internal/utils"
	"dvgmu/api/internal/utils/docx"
	"dvgmu/api/internal/utils/rtf"
	"dvgmu/api/internal/utils/txt"
)

const testImportMaxBytes = 20 << 20

type TestSaver interface {
	TestCreate(ctx context.Context, test *models.Test) (int64, error)
	TestUpdate(ctx context.Context, test *models.Test) error
	TestDelete(ctx context.Context, id int64) error
	TestExportStatusUpdate(ctx context.Context, id int64, status enum.TestExportStatus) error
}

type TestProvider interface {
	TestFetch(ctx context.Context, filter models.TestFilter) ([]*models.Test, error)
	TestByID(ctx context.Context, id int64) (*models.Test, error)
}

// TestImageStore registers the questions' pictures (test_images).
type TestImageStore interface {
	TestImageSave(ctx context.Context, img *models.TestImage) error
	TestImages(ctx context.Context, hashes []string) (map[string]*models.TestImage, error)
}

// TestImageFiles keeps the pictures' files (the files service, tests/images).
type TestImageFiles interface {
	Store(ctx context.Context, name string, content []byte) (fileID int64, err error)
	Load(ctx context.Context, fileID int64) ([]byte, error)
}

type TestService struct {
	log      *slog.Logger
	saver    TestSaver
	provider TestProvider
	images   TestImageStore
	files    TestImageFiles
}

func NewTestService(log *slog.Logger, saver TestSaver, provider TestProvider, images TestImageStore, files TestImageFiles) *TestService {
	return &TestService{log: log, saver: saver, provider: provider, images: images, files: files}
}

// withImageSizes checks the test's pictures are stored and copies their sizes.
func (s *TestService) withImageSizes(ctx context.Context, test *models.Test) error {
	sizes, err := s.images.TestImages(ctx, test.ImageHashes())
	if err != nil {
		return err
	}
	return test.SetImageSizes(sizes)
}

// TestImageUpload stores a question's picture in the files service and
// registers it; the same picture again is not stored twice.
func (s *TestService) TestImageUpload(ctx context.Context, data []byte) (*models.TestImage, error) {
	const op = "Test.TestImageUpload"
	log := s.log.With(slog.String("op", op))

	img, err := models.NewTestImage(data, time.Now())
	if err != nil {
		log.Warn(utils.MSGValidateFailed("test image", err))
		return nil, err
	}
	known, err := s.images.TestImages(ctx, []string{img.Hash})
	if err != nil {
		log.Error(utils.MSGFetchError("test image", err))
		return nil, err
	}
	if stored, ok := known[img.Hash]; ok {
		return stored, nil
	}

	if s.files == nil {
		return nil, fmt.Errorf("%w: сервис файлов не настроен (PACKAGE_FILES) — картинки негде хранить", models.ErrTestInvalid)
	}
	img.FileID, err = s.files.Store(ctx, img.FileName(), data)
	if err != nil {
		log.Error("test image not stored in the files service", slog.String("error", err.Error()))
		return nil, err
	}
	if err := s.images.TestImageSave(ctx, img); err != nil {
		log.Error(utils.MSGCreateError("test image", err))
		return nil, err
	}
	log.Info("test image stored", slog.String("hash", img.Hash), slog.Int64("file_id", img.FileID), slog.Int("bytes", len(data)))
	return img, nil
}

// TestImage: one registered picture with its file, for serving it.
func (s *TestService) TestImage(ctx context.Context, hash string) (*models.TestImage, error) {
	found, err := s.TestImageFiles(ctx, []string{hash})
	if err != nil {
		return nil, err
	}
	img, ok := found[hash]
	if !ok {
		return nil, models.ErrTestNotFound
	}
	return img, nil
}

// TestImageFiles: the registered pictures among hashes, with their files read
// from the files service.
func (s *TestService) TestImageFiles(ctx context.Context, hashes []string) (map[string]*models.TestImage, error) {
	found, err := s.images.TestImages(ctx, hashes)
	if err != nil {
		return nil, err
	}
	if len(found) > 0 && s.files == nil {
		return nil, errors.New("сервис файлов не настроен (PACKAGE_FILES)")
	}
	for _, img := range found {
		if img.Data, err = s.files.Load(ctx, img.FileID); err != nil {
			return nil, err
		}
	}
	return found, nil
}

func (s *TestService) TestFetch(ctx context.Context, filter models.TestFilter) ([]*models.Test, error) {
	const op = "Test.TestFetch"
	log := s.log.With(slog.String("op", op))

	list, err := s.provider.TestFetch(ctx, filter)
	if err != nil {
		log.Error(utils.MSGFetchError("test", err))
		return nil, err
	}

	log.Info(utils.MSGFetchSuccess("test", len(list)))
	return list, nil
}

func (s *TestService) TestByID(ctx context.Context, id int64) (*models.Test, error) {
	const op = "Test.TestByID"
	log := s.log.With(slog.String("op", op), slog.Int64("test_id", id))

	test, err := s.provider.TestByID(ctx, id)
	if err != nil {
		if errors.Is(err, models.ErrTestNotFound) {
			log.Warn(utils.MSGNotFoundError("test", id))
			return nil, err
		}
		log.Error(utils.MSGDBFetchByIDError("test", id, err))
		return nil, err
	}
	return test, nil
}

func (s *TestService) TestCreate(ctx context.Context, params models.TestParams) (int64, error) {
	const op = "Test.TestCreate"
	log := s.log.With(slog.String("op", op))

	test, err := models.NewTest(params, time.Now())
	if err == nil {
		err = s.withImageSizes(ctx, test)
	}
	if err != nil {
		log.Warn(utils.MSGValidateFailed("test", err))
		return 0, err
	}

	id, err := s.saver.TestCreate(ctx, test)
	if err != nil {
		log.Error(utils.MSGCreateError("test", err))
		return 0, err
	}

	log.Info(utils.MSGCreateSuccess("test", id))
	return id, nil
}

func (s *TestService) TestUpdate(ctx context.Context, id int64, params models.TestParams) error {
	const op = "Test.TestUpdate"
	log := s.log.With(slog.String("op", op), slog.Int64("test_id", id))

	test, err := models.NewTest(params, time.Now())
	if err == nil {
		err = s.withImageSizes(ctx, test)
	}
	if err != nil {
		log.Warn(utils.MSGValidateFailed("test", err))
		return err
	}
	test.ID = id

	if err := s.saver.TestUpdate(ctx, test); err != nil {
		if errors.Is(err, models.ErrTestNotFound) {
			log.Warn(utils.MSGNotFoundError("test", id))
			return err
		}
		log.Error(utils.MSGDBUpdateError("test", id, err))
		return err
	}

	log.Info(utils.MSGUpdateSuccess("test", id))
	return nil
}

func (s *TestService) TestDelete(ctx context.Context, id int64) error {
	const op = "Test.TestDelete"
	log := s.log.With(slog.String("op", op), slog.Int64("test_id", id))

	if err := s.saver.TestDelete(ctx, id); err != nil {
		if errors.Is(err, models.ErrTestNotFound) {
			log.Warn(utils.MSGNotFoundError("test", id))
			return err
		}
		log.Error(utils.MSGDBDeleteError("test", id, err))
		return err
	}

	log.Info(utils.MSGDeleteSuccess("test", id))
	return nil
}

// TestExport renders the test as an .rtf file; returns its name and content.
func (s *TestService) TestExport(ctx context.Context, id int64) (string, []byte, error) {
	test, err := s.TestByID(ctx, id)
	if err != nil {
		return "", nil, err
	}

	images, err := s.TestImageFiles(ctx, test.ImageHashes())
	if err != nil {
		s.log.Error("test export: pictures not read", slog.Int64("test_id", id), slog.String("error", err.Error()))
		return "", nil, err
	}

	doc := rtf.Test{Topic: test.Topic, Questions: make([]rtf.Question, 0, len(test.Questions))}
	for _, q := range test.Questions {
		options := make([]rtf.Option, 0, len(q.Answers))
		for _, a := range q.Answers {
			options = append(options, rtf.Option{Text: a.Text, Correct: a.IsCorrect})
		}
		question := rtf.Question{Text: q.Text, Options: options}
		if img, ok := images[q.Image]; ok {
			question.Image = &rtf.Image{Data: img.Data, PNG: img.Mime == "image/png", Width: img.Width, Height: img.Height}
		}
		doc.Questions = append(doc.Questions, question)
	}

	s.log.Info("test exported", slog.String("op", "Test.TestExport"), slog.Int64("test_id", id))
	return rtf.FileName(test.Topic), rtf.TestDocument(doc), nil
}

// TestImportParse reads a supplied .docx or .txt into a draft: topic (from the file
// name), questions and warnings to check. Nothing is saved.
func (s *TestService) TestImportParse(ctx context.Context, fileName string, content []byte) (models.TestParams, []string, error) {
	const op = "Test.TestImportParse"
	log := s.log.With(slog.String("op", op), slog.String("file_name", fileName))

	var parse func([]byte) (docx.Test, error)
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".docx":
		parse = docx.ParseTest
	case ".txt":
		parse = txt.ParseTest
	default:
		return models.TestParams{}, nil, fmt.Errorf("%w: нужен файл .docx или .txt (файл .doc пересохраните в Word как .docx)", models.ErrTestImportInvalid)
	}
	if len(content) > testImportMaxBytes {
		return models.TestParams{}, nil, fmt.Errorf("%w: файл больше 20 МБ", models.ErrTestImportInvalid)
	}

	parsed, err := parse(content)
	if err != nil {
		log.Warn("test import failed", slog.String("error", err.Error()))
		return models.TestParams{}, nil, fmt.Errorf("%w: %s", models.ErrTestImportInvalid, err.Error())
	}

	params := models.TestParams{
		Topic:     strings.TrimSpace(strings.TrimSuffix(filepath.Base(fileName), filepath.Ext(fileName))),
		Questions: make([]models.TestQuestionParams, 0, len(parsed.Questions)),
	}
	warnings := parsed.Warnings
	for i, q := range parsed.Questions {
		answers := make([]models.TestAnswerParams, 0, len(q.Options))
		for _, o := range q.Options {
			answers = append(answers, models.TestAnswerParams{Text: o.Text, IsCorrect: o.Correct})
		}
		question := models.TestQuestionParams{Text: q.Text, Answers: answers}
		// The file's pictures are stored right away (the same one once), so
		// the draft carries just their ids.
		if q.Image != nil {
			img, err := s.TestImageUpload(ctx, q.Image.Data)
			if err != nil {
				warnings = append(warnings, fmt.Sprintf("вопрос %d: картинку не удалось сохранить — %s", i+1, strings.TrimPrefix(err.Error(), models.ErrTestInvalid.Error()+": ")))
			} else {
				question.Image = img.Hash
			}
		}
		params.Questions = append(params.Questions, question)
	}

	log.Info("test import parsed", slog.Int("questions", len(params.Questions)), slog.Int("warnings", len(warnings)))
	return params, warnings, nil
}

func (s *TestService) TestExportStatusUpdate(ctx context.Context, id int64, status enum.TestExportStatus) error {
	const op = "Test.TestExportStatusUpdate"
	log := s.log.With(slog.String("op", op), slog.Int64("test_id", id), slog.String("export_status", status.String()))

	if err := models.ValidTestExportStatus(status); err != nil {
		log.Warn(utils.MSGValidateFailed("test export status", err))
		return err
	}
	if err := s.saver.TestExportStatusUpdate(ctx, id, status); err != nil {
		if errors.Is(err, models.ErrTestNotFound) {
			log.Warn(utils.MSGNotFoundError("test", id))
			return err
		}
		log.Error(utils.MSGDBUpdateError("test export status", id, err))
		return err
	}

	log.Info(utils.MSGUpdateSuccess("test export status", id))
	return nil
}
