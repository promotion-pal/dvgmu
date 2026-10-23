import type { FieldValues, Path } from "react-hook-form";

type QuestionFieldVariant<T extends FieldValues = FieldValues> =
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
      /** Значение поля — массив выбранных `value` в порядке нажатия. */
      options: SelectOption[];
      /**
       * Необязательный свободный ввод «Другое» на той же странице: имя
       * строкового поля формы, куда пишется текст со своими вариантами.
       */
      otherName?: Path<T>;
      otherLabel?: string;
      otherPlaceholder?: string;
    };

export type QuestionFieldConfig<T extends FieldValues = FieldValues> =
  QuestionFieldVariant<T> & {
    /**
     * Условие показа вопроса — вызывается с текущими значениями формы.
     * Вопрос (и его страница в мастере) скрывается, если функция вернёт
     * false. Без неё вопрос виден всегда. См. `question.groups.tsx`,
     * ПДн-вопросы анкеты ИБ.
     */
    visibleWhen?: (values: Record<string, unknown>) => boolean;
  };

/** Один пункт выпадающего списка. `value` — числовое значение enum. */
export interface SelectOption {
  value: number;
  label: string;
}

export interface QuestionGroup<T extends FieldValues = FieldValues> {
  title: string;
  description: string;
  fields: QuestionFieldConfig<T>[];
}
