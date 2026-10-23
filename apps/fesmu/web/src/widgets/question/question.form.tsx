/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import { HeartIcon } from "lucide-react";
import type { ReactNode} from "react";
import { useEffect, useState } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";
import { Controller, useController } from "react-hook-form";

interface CommonQuestionProps {
  id?: number;
  title: string;
  icon: ReactNode;
  pages: ReactNode[];
  isLoading?: boolean;
  error?: string | null;
  description: string;
  onSubmit?: (currentPageData?: any) => void | Promise<void>;
  /**
   * Проверка текущей страницы перед переходом дальше / отправкой.
   * Возвращает false — переход блокируется, ошибки показывают сами поля.
   */
  onValidatePage?: (page: number) => boolean | Promise<boolean>;
}

const CommonQuestion = ({
  id,
  icon,
  pages,
  title,
  onSubmit,
  onValidatePage,
  description,
  error = null,
  isLoading = false,
}: CommonQuestionProps) => {
  const [page, setPage] = useState<number>(0);
  const [maxVisited, setMaxVisited] = useState<number>(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const totalPages = pages.length;
  const isFirstPage = page === 0;
  const isLastPage = page === totalPages - 1;

  // Список страниц может сократиться на лету (напр. респондент ответил
  // «не работаю с ПДн», и условные вопросы пропали) — если текущая страница
  // выпала из мастера, откатываемся на последнюю оставшуюся.
  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [totalPages, page]);

  const handleNextPage = async () => {
    if (isLoading) return;

    const valid = onValidatePage ? await onValidatePage(page) : true;
    if (!valid) {
      setLocalError("Заполните вопрос на этом экране, чтобы продолжить");
      return;
    }

    setLocalError(null);

    if (!isLastPage) {
      const next = page + 1;
      setPage(next);
      setMaxVisited((prev) => Math.max(prev, next));
    } else if (onSubmit) {
      onSubmit();
    }
  };

  const handlePrevPage = () => {
    if (!isFirstPage) {
      setLocalError(null);
      setPage((prev) => prev - 1);
    }
  };

  const handleGoToPage = async (pageNumber: number) => {
    if (pageNumber < 0 || pageNumber >= totalPages || pageNumber === page) return;

    // Назад и на уже пройденные экраны — свободно; вперёд по неотвеченным нельзя.
    if (pageNumber > maxVisited) return;
    if (pageNumber > page && onValidatePage && !(await onValidatePage(page))) {
      setLocalError("Заполните вопрос на этом экране, чтобы продолжить");
      return;
    }

    setLocalError(null);
    setPage(pageNumber);
  };

  return (
    <section className="flex flex-col items-center py-8 px-4 mt-10 w-full">
      <div className="text-center mb-8 space-y-3 w-full">
        <div className="flex justify-center">{icon}</div>
        <h2 className="break-words">{title}</h2>
        <p className="text-text text-sm break-words">{description}</p>
      </div>

      <div className="w-full">
        <div className="question-page">{pages[page]}</div>

        {(error || localError) && (
          <div className="error-message text-red-500 text-sm mt-2 mb-4">
            {error || localError}
          </div>
        )}

        <div className="navigation-buttons flex gap-3 mt-8">
          {!isFirstPage && (
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={isLoading}
              className="flex-1 border border-border text-text font-medium py-3 rounded-lg cursor-pointer transition hover:border-accent disabled:opacity-50"
            >
              ← Назад
            </button>
          )}

          <button
            type="button"
            onClick={handleNextPage}
            disabled={isLoading}
            className={`${
              isFirstPage ? "w-full" : "flex-1"
            } bg-accent text-white font-bold py-3 rounded-lg cursor-pointer transition hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2`}
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Отправка...
              </>
            ) : isLastPage ? (
              "📤 Отправить"
            ) : (
              "Далее →"
            )}
          </button>
        </div>

        {totalPages > 1 && (
          <div className="progress-indicator flex justify-center gap-2 mt-6">
            {pages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleGoToPage(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === page
                    ? "w-6 bg-accent"
                    : idx < page
                      ? "w-4 bg-accent/50"
                      : "w-4 bg-border"
                }`}
              />
            ))}
          </div>
        )}
      </div>
      {id && (
        <div className="mt-6 text-center">
          <div className="bg-accent-bg rounded-lg p-3">
            <p className="text-xs text-text">QR код: №{id}</p>
          </div>
        </div>
      )}
    </section>
  );
};

interface QuestionFieldProps<T extends FieldValues = FieldValues> {
  name: Path<T>;
  control: Control<T>;
  title: string;
  description: string;
}

/** Сообщение об ошибке под вопросом. */
const FieldError = ({ message }: { message?: string }) =>
  message ? (
    <p className="mt-3 text-sm text-red-500" role="alert">
      {message}
    </p>
  ) : null;

interface RatingQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  max?: number;
  min?: number;
  labels?: Record<number, string>;
}
const RatingQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  labels,
  max = 5,
  min = 1,
  description,
}: RatingQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value }, fieldState }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2 break-words">{title}</h3>
          <p className="text-text mb-6">{description}</p>

          <div className="space-y-6 mt-6">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: max - min + 1 }, (_, i) => i + min).map(
                (val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => onChange(val)}
                    className={`
                w-12 h-12 rounded-full font-bold transition-all cursor-pointer
                ${
                  value === val
                    ? "bg-accent-bg text-accent border-2 border-accent scale-110"
                    : "border border-border text-text hover:border-accent"
                }
              `}
                  >
                    {val}
                  </button>
                ),
              )}
            </div>
            {labels && value && (
              <div className="text-center text-sm text-text">
                {labels[value]}
              </div>
            )}
          </div>

          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  );
};

interface BooleanQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  options?: Record<string, string>;
}
const BooleanQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  options = { true: "Да", false: "Нет" },
}: BooleanQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value }, fieldState }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2 break-words">{title}</h3>
          <p className="text-text mb-6">{description}</p>

          <div className="flex gap-4 mt-6">
            {Object.entries(options).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key === "true")}
                className={`
              flex-1 py-3 rounded-lg font-medium transition-all cursor-pointer
              ${
                value === (key === "true")
                  ? "bg-accent text-white"
                  : "border border-border text-text hover:border-accent"
              }
            `}
              >
                {label}
              </button>
            ))}
          </div>

          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  );
};

interface TextareaQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  placeholder?: string;
}
const TextareaQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  placeholder,
}: TextareaQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2 break-words">{title}</h3>
          <p className="text-text mb-6">{description}</p>

          <textarea
            {...field}
            value={field.value ?? ""}
            placeholder={placeholder}
            className="w-full border border-border mt-6 rounded-lg p-3 bg-transparent text-current resize-none focus:outline-none focus:border-accent transition-colors"
            rows={4}
          />

          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  );
};

interface TextQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  placeholder?: string;
}
const TextQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  placeholder,
}: TextQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2 break-words">{title}</h3>
          <p className="text-text mb-6">{description}</p>

          <input
            {...field}
            value={field.value ?? ""}
            type="text"
            placeholder={placeholder}
            className="w-full border border-border mt-6 rounded-lg p-3 bg-transparent text-current focus:outline-none focus:border-accent transition-colors"
          />

          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  );
};

interface SelectOptionItem {
  value: number;
  label: string;
}
interface SelectQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  options: SelectOptionItem[];
  placeholder?: string;
}
const SelectQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  options,
  placeholder = "Выберите вариант...",
}: SelectQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value, ...field }, fieldState }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2 break-words">{title}</h3>
          <p className="text-text mb-6">{description}</p>

          <select
            {...field}
            value={value ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full border border-border mt-6 rounded-lg p-3 bg-transparent text-current focus:outline-none focus:border-accent transition-colors cursor-pointer"
          >
            <option value={0} disabled>
              {placeholder}
            </option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <FieldError message={fieldState.error?.message} />
        </div>
      )}
    />
  );
};

interface ComboboxQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  options: string[];
  placeholder?: string;
  otherLabel?: string;
}
const COMBOBOX_OTHER = "__other__";
/**
 * Выпадающий список из готовых строк + пункт «Другое», который открывает
 * поле для ручного ввода. Значение поля — строка.
 */
const ComboboxQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  options,
  placeholder = "Выберите вариант...",
  otherLabel = "Другое (указать свой)",
}: ComboboxQuestionProps<T>) => {
  // useController, а не render-проп Controller: хук useState нельзя звать
  // внутри колбэка.
  const {
    field: { onChange, value },
    fieldState,
  } = useController({ name, control });
  const current = typeof value === "string" ? value : "";
  const isPreset = current !== "" && options.includes(current);
  const [isOther, setIsOther] = useState<boolean>(current !== "" && !isPreset);
  const selectValue = isOther ? COMBOBOX_OTHER : isPreset ? current : "";

  return (
    <div>
      <h3 className="text-xl font-bold text-text-h mb-2 break-words">
        {title}
      </h3>
      <p className="text-text mb-6">{description}</p>

      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === COMBOBOX_OTHER) {
            setIsOther(true);
            onChange("");
          } else {
            setIsOther(false);
            onChange(v);
          }
        }}
        className="w-full border border-border mt-6 rounded-lg p-3 bg-transparent text-current focus:outline-none focus:border-accent transition-colors cursor-pointer"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        <option value={COMBOBOX_OTHER}>{otherLabel}</option>
      </select>

      {isOther && (
        <input
          type="text"
          autoFocus
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Введите свой вариант"
          className="w-full border border-border mt-3 rounded-lg p-3 bg-transparent text-current focus:outline-none focus:border-accent transition-colors"
        />
      )}

      <FieldError message={fieldState.error?.message} />
    </div>
  );
};

interface MultiSelectQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  options: SelectOptionItem[];
  /** Имя строкового поля формы для свободного ввода «Другое» на той же странице. */
  otherName?: Path<T>;
  otherLabel?: string;
  otherPlaceholder?: string;
}
/**
 * Список вариантов кнопками: тап — добавить (появляется номер в порядке выбора),
 * повторный тап — убрать (остальные перенумеровываются). Значение поля —
 * `number[]` в порядке нажатия. Без нативного <select>: на телефоне
 * выпадашка-«копилка» вела себя непредсказуемо.
 */
const MultiSelectQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  options,
  otherName,
  otherLabel = "Другое — не из списка",
  otherPlaceholder = "Впишите свои варианты через запятую",
}: MultiSelectQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value }, fieldState }) => {
        const selected: number[] = Array.isArray(value) ? value : [];

        const toggle = (v: number) => {
          onChange(
            selected.includes(v)
              ? selected.filter((x) => x !== v)
              : [...selected, v],
          );
        };

        return (
          <div>
            <h3 className="text-xl font-bold text-text-h mb-2 break-words">{title}</h3>
            <p className="text-text mb-6">{description}</p>

            <div className="flex flex-col gap-2 mt-6">
              {options.map((opt) => {
                const order = selected.indexOf(opt.value);
                const isSelected = order !== -1;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "border-accent bg-accent-bg"
                        : "border-border hover:border-accent"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected
                          ? "bg-accent text-white"
                          : "border border-border text-text"
                      }`}
                    >
                      {isSelected ? order + 1 : ""}
                    </span>
                    <span className="flex-1 text-text">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {otherName && (
              <Controller
                name={otherName}
                control={control}
                render={({ field: other }) => (
                  <div className="mt-4">
                    <label className="text-text text-sm mb-2 block">
                      {otherLabel}
                    </label>
                    <textarea
                      value={typeof other.value === "string" ? other.value : ""}
                      onChange={(e) => other.onChange(e.target.value)}
                      onBlur={other.onBlur}
                      placeholder={otherPlaceholder}
                      rows={2}
                      className="w-full border border-border rounded-lg p-3 bg-transparent text-current focus:outline-none focus:border-accent transition-colors resize-none"
                    />
                  </div>
                )}
              />
            )}

            <FieldError message={fieldState.error?.message} />
          </div>
        );
      }}
    />
  );
};

const QuestionGratitude = () => {
  return (
    <section className="flex flex-col items-center justify-center text-center p-8 space-y-6 animate-in fade-in zoom-in-90 duration-500">
      <div className="animate-pulse">
        <HeartIcon className="w-24 h-24 text-accent text-red-500" />
      </div>
      <h2 className="text-2xl font-bold">Спасибо за ваш отзыв!</h2>
    </section>
  );
};

export {
  CommonQuestion,
  RatingQuestion,
  BooleanQuestion,
  TextareaQuestion,
  TextQuestion,
  SelectQuestion,
  ComboboxQuestion,
  MultiSelectQuestion,
  QuestionGratitude,
};