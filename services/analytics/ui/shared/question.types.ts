import type { FieldValues, Path } from "react-hook-form";

/**
 * Описание одного вопроса в виде данных — без привязки к конкретному проекту.
 * Из массива таких описаний `buildQuestionPages` собирает готовые страницы формы.
 */
export type QuestionFieldConfig<T extends FieldValues = FieldValues> =
  | {
      kind: "rating";
      name: Path<T>;
      title: string;
      description: string;
      min?: number;
      max?: number;
      labels?: Record<number, string>;
    }
  | {
      kind: "boolean";
      name: Path<T>;
      title: string;
      description: string;
      options?: Record<string, string>;
    }
  | {
      kind: "textarea";
      name: Path<T>;
      title: string;
      description: string;
      placeholder?: string;
    }
  | {
      kind: "text";
      name: Path<T>;
      title: string;
      description: string;
      placeholder?: string;
    }
  | {
      kind: "select";
      name: Path<T>;
      title: string;
      description: string;
      placeholder?: string;
      /** Варианты выпадающего списка, обычно построенные из enum. */
      options: SelectOption[];
    }
  | {
      kind: "combobox";
      name: Path<T>;
      title: string;
      description: string;
      placeholder?: string;
      /**
       * Готовые варианты (строки). Пользователь может выбрать один из них
       * или пункт «Другое» и вписать свой. Значение поля — строка.
       */
      options: string[];
      /** Подпись пункта «свой вариант». По умолчанию «Другое (указать свой)». */
      otherLabel?: string;
    }
  | {
      kind: "multiselect";
      name: Path<T>;
      title: string;
      description: string;
      placeholder?: string;
      /**
       * Варианты выпадающего списка (обычно из enum). Значение поля —
       * массив `number` в порядке выбора пользователя.
       */
      options: SelectOption[];
      /**
       * Необязательный свободный ввод «Другое» на той же странице: имя
       * строкового поля формы, куда пишется текст со своими вариантами.
       */
      otherName?: Path<T>;
      otherLabel?: string;
      otherPlaceholder?: string;
    };

/** Один пункт выпадающего списка. `value` — числовое значение enum. */
export interface SelectOption {
  value: number;
  label: string;
}

/** Группа вопросов = одна анкета. */
export interface QuestionGroup<T extends FieldValues = FieldValues> {
  title: string;
  description: string;
  fields: QuestionFieldConfig<T>[];
}
