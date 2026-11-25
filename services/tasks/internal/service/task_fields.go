package service

import (
	"errors"
	"fmt"
	"maps"
	"math"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	entity "fesmu/contract/tasks/entity"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/types/known/structpb"
)

func validateTaskFields(encoded string, fields map[string]*structpb.Value) error {
	var schema entity.ServiceFormSchema
	if err := protojson.Unmarshal([]byte(encoded), &schema); err != nil {
		return fmt.Errorf("decode stored form schema: %w", err)
	}
	known := make(map[string]struct{}, len(schema.Fields))
	for _, definition := range schema.Fields {
		known[definition.Code] = struct{}{}
		if err := validateTaskField(definition, fields[definition.Code]); err != nil {
			return fmt.Errorf("%w: field %q: %v", ErrInvalidTask, definition.Code, err)
		}
	}
	for _, code := range slices.Sorted(maps.Keys(fields)) {
		if _, exists := known[code]; !exists {
			return fmt.Errorf("%w: unknown field %q", ErrInvalidTask, code)
		}
	}
	return nil
}

func validateTaskField(field *entity.FormField, value *structpb.Value) error {
	if field.Type == entity.FormFieldType_FORM_FIELD_TYPE_ATTACHMENT {
		if field.GetRequired() || value != nil {
			return errors.New("attachment submission is unavailable")
		}
		return nil
	}
	if value == nil {
		if field.GetRequired() {
			return errors.New("value is required")
		}
		return nil
	}

	switch field.Type {
	case entity.FormFieldType_FORM_FIELD_TYPE_SHORT_TEXT, entity.FormFieldType_FORM_FIELD_TYPE_LONG_TEXT:
		text, ok := value.Kind.(*structpb.Value_StringValue)
		if !ok || strings.ContainsRune(text.StringValue, 0) {
			return errors.New("expected text")
		}
		if field.GetRequired() && strings.TrimSpace(text.StringValue) == "" {
			return errors.New("value is required")
		}
		if limit := field.GetText().GetMaxLength(); limit > 0 && utf8.RuneCountInString(text.StringValue) > int(limit) {
			return fmt.Errorf("maximum length is %d characters", limit)
		}
	case entity.FormFieldType_FORM_FIELD_TYPE_NUMBER:
		number, ok := value.Kind.(*structpb.Value_NumberValue)
		if !ok || math.IsNaN(number.NumberValue) || math.IsInf(number.NumberValue, 0) {
			return errors.New("expected a finite number")
		}
		if bounds := field.GetNumber(); bounds != nil {
			if bounds.Min != nil && number.NumberValue < *bounds.Min {
				return fmt.Errorf("minimum value is %g", *bounds.Min)
			}
			if bounds.Max != nil && number.NumberValue > *bounds.Max {
				return fmt.Errorf("maximum value is %g", *bounds.Max)
			}
		}
	case entity.FormFieldType_FORM_FIELD_TYPE_DATE:
		date, ok := value.Kind.(*structpb.Value_StringValue)
		if !ok {
			return errors.New("expected date in YYYY-MM-DD format")
		}
		if _, err := time.Parse(time.DateOnly, date.StringValue); err != nil {
			return errors.New("expected date in YYYY-MM-DD format")
		}
	case entity.FormFieldType_FORM_FIELD_TYPE_BOOLEAN:
		if _, ok := value.Kind.(*structpb.Value_BoolValue); !ok {
			return errors.New("expected true or false")
		}
	case entity.FormFieldType_FORM_FIELD_TYPE_SINGLE_CHOICE:
		return validateTaskChoices(field, []*structpb.Value{value})
	case entity.FormFieldType_FORM_FIELD_TYPE_MULTIPLE_CHOICE:
		list := value.GetListValue()
		if list == nil {
			return errors.New("expected a list of option codes")
		}
		return validateTaskChoices(field, list.Values)
	default:
		return errors.New("unsupported field type")
	}
	return nil
}

func validateTaskChoices(field *entity.FormField, values []*structpb.Value) error {
	if field.GetRequired() && len(values) == 0 {
		return errors.New("select at least one option")
	}
	allowed := make(map[string]bool, len(field.GetChoice().GetOptions()))
	for _, option := range field.GetChoice().GetOptions() {
		allowed[option.Code] = true
	}
	for _, value := range values {
		code := value.GetStringValue()
		if !allowed[code] {
			return errors.New("expected distinct configured option codes")
		}
		allowed[code] = false
	}
	return nil
}
