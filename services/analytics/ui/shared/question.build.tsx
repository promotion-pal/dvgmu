import type { Control, FieldValues } from "react-hook-form";
import {
  BooleanQuestion,
  ComboboxQuestion,
  MultiSelectQuestion,
  RatingQuestion,
  SelectQuestion,
  TextQuestion,
  TextareaQuestion,
} from "./question.form";
import type { QuestionFieldConfig } from "./question.types";

export function buildQuestionPages<T extends FieldValues>(
  fields: QuestionFieldConfig<T>[],
  control: Control<T>,
) {
  return fields.map((field) => {
    switch (field.kind) {
      case "rating": {
        const { kind, ...props } = field;
        return <RatingQuestion key={props.name} control={control} {...props} />;
      }
      case "boolean": {
        const { kind, ...props } = field;
        return <BooleanQuestion key={props.name} control={control} {...props} />;
      }
      case "textarea": {
        const { kind, ...props } = field;
        return <TextareaQuestion key={props.name} control={control} {...props} />;
      }
      case "text": {
        const { kind, ...props } = field;
        return <TextQuestion key={props.name} control={control} {...props} />;
      }
      case "select": {
        const { kind, ...props } = field;
        return <SelectQuestion key={props.name} control={control} {...props} />;
      }
      case "combobox": {
        const { kind, ...props } = field;
        return <ComboboxQuestion key={props.name} control={control} {...props} />;
      }
      case "multiselect": {
        const { kind, ...props } = field;
        return (
          <MultiSelectQuestion key={props.name} control={control} {...props} />
        );
      }
    }
  });
}
