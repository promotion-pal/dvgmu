package word

import "errors"

var (
	ErrTemplateNotFound         = errors.New("word template not found")
	ErrOpenTemplate             = errors.New("failed to open docx template")
	ErrReadTemplateEntry        = errors.New("failed to read docx template entry")
	ErrWriteDocx                = errors.New("failed to write docx")
	ErrGenerateDocument         = errors.New("failed to generate document")
	ErrUnfilledPlaceholders     = errors.New("template has placeholders without a value")
	ErrProfileRequired          = errors.New("profile is required")
	ErrStudentRequired          = errors.New("profile has no student data")
	ErrDormitoryParams          = errors.New("dormitory application params are required")
	ErrTemporaryResidenceParams = errors.New("temporary residence params are required")
	ErrDormitoryAddress         = errors.New("dormitory address is required")
	ErrUnknownEducationForm     = errors.New("unknown education form")
	ErrInvalidRecordBook        = errors.New("invalid record book number")
	ErrUnknownFacultyCode       = errors.New("unknown faculty code")
)
