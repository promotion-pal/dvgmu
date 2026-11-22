package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"regexp"
	"slices"
	"strings"

	"dvgmu/tasks/internal/storage"
	entity "fesmu/contract/tasks/entity"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

var ErrInvalidServiceForm = errors.New("invalid service form")

var attachmentMIMEPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9!#$&^_.+-]*/([a-z0-9][a-z0-9!#$&^_.+-]*|\*)$`)

type ServiceFormService struct {
	storage *storage.ServiceFormStorage
}

func NewServiceFormService(storage *storage.ServiceFormStorage) *ServiceFormService {
	return &ServiceFormService{storage: storage}
}

func (s *ServiceFormService) Get(ctx context.Context, serviceID int64) (*entity.ServiceFormSchema, int64, error) {
	if serviceID <= 0 {
		return nil, 0, fmt.Errorf("%w: service_id must be positive", ErrInvalidServiceForm)
	}
	form, err := s.storage.Get(ctx, serviceID)
	if err != nil {
		return nil, 0, err
	}
	var schema entity.ServiceFormSchema
	if err := protojson.Unmarshal([]byte(form.Schema), &schema); err != nil {
		return nil, 0, fmt.Errorf("decode stored form schema: %w", err)
	}
	return &schema, form.Version, nil
}

func (s *ServiceFormService) Update(ctx context.Context, serviceID, expectedVersion int64, input *entity.ServiceFormSchema) (*entity.ServiceFormSchema, int64, error) {
	if serviceID <= 0 || expectedVersion < 0 || expectedVersion == math.MaxInt64 || input == nil {
		return nil, 0, fmt.Errorf("%w: provide service_id, a valid version and a schema", ErrInvalidServiceForm)
	}
	schema := proto.CloneOf(input)
	if err := validateFormFields(schema.Fields); err != nil {
		return nil, 0, fmt.Errorf("%w: %v", ErrInvalidServiceForm, err)
	}
	slices.SortFunc(schema.Fields, func(a, b *entity.FormField) int {
		if a.SortOrder != b.SortOrder {
			if a.SortOrder < b.SortOrder {
				return -1
			}
			return 1
		}
		return strings.Compare(a.Code, b.Code)
	})
	encoded, err := protojson.Marshal(schema)
	if err != nil {
		return nil, 0, err
	}
	version, err := s.storage.Replace(ctx, serviceID, expectedVersion, string(encoded))
	return schema, version, err
}

func validateFormFields(fields []*entity.FormField) error {
	codes := make(map[string]struct{}, len(fields))
	for i, field := range fields {
		if field == nil {
			return fmt.Errorf("field %d is required", i+1)
		}
		field.Code = strings.TrimSpace(field.Code)
		field.Name = strings.TrimSpace(field.Name)
		if !catalogCodePattern.MatchString(field.Code) || !validCatalogName(field.Name) {
			return fmt.Errorf("field %d has an invalid code or name", i+1)
		}
		if _, exists := codes[field.Code]; exists {
			return fmt.Errorf("duplicate field code %q", field.Code)
		}
		codes[field.Code] = struct{}{}
		field.Required = proto.Bool(field.GetRequired())
		if err := validateFieldSettings(field); err != nil {
			return fmt.Errorf("field %q: %w", field.Code, err)
		}
	}
	return nil
}

func validateFieldSettings(field *entity.FormField) error {
	if field.Settings != nil &&
		field.GetText() == nil && field.GetNumber() == nil && field.GetChoice() == nil && field.GetAttachment() == nil {
		return errors.New("settings must contain a value")
	}
	switch field.Type {
	case entity.FormFieldType_FORM_FIELD_TYPE_SHORT_TEXT, entity.FormFieldType_FORM_FIELD_TYPE_LONG_TEXT:
		if field.Settings != nil && (field.GetText() == nil || field.GetText().MaxLength <= 0) {
			return errors.New("text settings require a positive max_length")
		}
	case entity.FormFieldType_FORM_FIELD_TYPE_NUMBER:
		if field.Settings != nil && field.GetNumber() == nil {
			return errors.New("number field requires number settings")
		}
		if number := field.GetNumber(); number != nil {
			min, max := number.GetMin(), number.GetMax()
			if math.IsNaN(min) || math.IsNaN(max) || math.IsInf(min, 0) || math.IsInf(max, 0) ||
				(number.Min != nil && number.Max != nil && min > max) {
				return errors.New("number bounds must be finite and min must not exceed max")
			}
		}
	case entity.FormFieldType_FORM_FIELD_TYPE_DATE, entity.FormFieldType_FORM_FIELD_TYPE_BOOLEAN:
		if field.Settings != nil {
			return errors.New("this field type has no settings")
		}
	case entity.FormFieldType_FORM_FIELD_TYPE_SINGLE_CHOICE, entity.FormFieldType_FORM_FIELD_TYPE_MULTIPLE_CHOICE:
		return validateChoiceSettings(field.GetChoice())
	case entity.FormFieldType_FORM_FIELD_TYPE_ATTACHMENT:
		return validateAttachmentSettings(field.GetAttachment())
	default:
		return errors.New("unknown field type")
	}
	return nil
}

func validateChoiceSettings(choice *entity.FormChoiceSettings) error {
	if choice == nil || len(choice.Options) == 0 {
		return errors.New("at least one choice option is required")
	}
	codes := make(map[string]struct{}, len(choice.Options))
	for _, option := range choice.Options {
		if option == nil {
			return errors.New("choice option is required")
		}
		option.Code = strings.TrimSpace(option.Code)
		option.Name = strings.TrimSpace(option.Name)
		if !catalogCodePattern.MatchString(option.Code) || !validCatalogName(option.Name) {
			return errors.New("invalid choice option code or name")
		}
		if _, exists := codes[option.Code]; exists {
			return fmt.Errorf("duplicate choice option %q", option.Code)
		}
		codes[option.Code] = struct{}{}
	}
	return nil
}

func validateAttachmentSettings(attachment *entity.FormAttachmentSettings) error {
	if attachment == nil || attachment.MaxFiles <= 0 || attachment.MaxFileSizeBytes <= 0 ||
		len(attachment.AllowedMimeTypes) == 0 {
		return errors.New("allowed MIME types, max_files and max_file_size_bytes are required")
	}
	types := make(map[string]struct{}, len(attachment.AllowedMimeTypes))
	for i, value := range attachment.AllowedMimeTypes {
		value = strings.ToLower(strings.TrimSpace(value))
		if !attachmentMIMEPattern.MatchString(value) {
			return fmt.Errorf("invalid MIME type %q", value)
		}
		if _, exists := types[value]; exists {
			return fmt.Errorf("duplicate MIME type %q", value)
		}
		types[value] = struct{}{}
		attachment.AllowedMimeTypes[i] = value
	}
	return nil
}
