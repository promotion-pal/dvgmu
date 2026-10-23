/* eslint-disable @typescript-eslint/no-unused-vars -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
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

/**
 * Имена полей на каждой странице анкеты — в том же порядке, что и `buildQuestionPages`.
 * Сейчас одна страница = один вопрос, но список делаем массивом на случай,
 * если на странице появится несколько полей.
 */
export function questionPageFieldNames<T extends FieldValues>(
  fields: QuestionFieldConfig<T>[],
): string[][] {
  return fields.map((field) =>
    field.kind === "multiselect" && field.otherName
      ? [field.name as string, field.otherName as string]
      : [field.name as string],
  );
}

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
