import { motion } from "framer-motion";
import { HeartIcon } from "lucide-react";
import { ReactNode, useState } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";

interface CommonQuestionProps {
  id?: number;
  title: string;
  icon: ReactNode;
  pages: ReactNode[];
  isLoading?: boolean;
  error?: string | null;
  description: string;
  onSubmit?: (currentPageData?: any) => void | Promise<void>;
}

const CommonQuestion = ({
  id,
  icon,
  pages,
  title,
  onSubmit,
  description,
  error = null,
  isLoading = false,
}: CommonQuestionProps) => {
  const [page, setPage] = useState<number>(0);
  const [localError, setLocalError] = useState<string | null>(null);

  const totalPages = pages.length;
  const isFirstPage = page === 0;
  const isLastPage = page === totalPages - 1;

  const handleNextPage = () => {
    if (!isLastPage) {
      setLocalError(null);
      setPage((prev) => prev + 1);
    } else if (isLastPage && onSubmit) {
      onSubmit();
    }
  };

  const handlePrevPage = () => {
    if (!isFirstPage) {
      setLocalError(null);
      setPage((prev) => prev - 1);
    }
  };

  const handleGoToPage = (pageNumber: number) => {
    if (pageNumber >= 0 && pageNumber < totalPages) {
      setLocalError(null);
      setPage(pageNumber);
    }
  };

  return (
    <section className="flex flex-col items-center py-8 px-4 mt-10 w-full">
      <div className="text-center mb-8 space-y-3">
        <div className="flex justify-center">{icon}</div>
        <h2>{title}</h2>
        <p className="text-text text-sm">{description}</p>
      </div>

      <div>
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
      render={({ field: { onChange, value } }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2">{title}</h3>
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
      render={({ field: { onChange, value } }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2">{title}</h3>
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
      render={({ field }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2">{title}</h3>
          <p className="text-text mb-6">{description}</p>

          <textarea
            {...field}
            placeholder={placeholder}
            className="w-full border border-border mt-6 rounded-lg p-3 bg-transparent text-current resize-none focus:outline-none focus:border-accent transition-colors"
            rows={4}
          />
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
      render={({ field }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2">{title}</h3>
          <p className="text-text mb-6">{description}</p>

          <input
            {...field}
            type="text"
            placeholder={placeholder}
            className="w-full border border-border mt-6 rounded-lg p-3 bg-transparent text-current focus:outline-none focus:border-accent transition-colors"
          />
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
      render={({ field: { onChange, value, ...field } }) => (
        <div>
          <h3 className="text-xl font-bold text-text-h mb-2">{title}</h3>
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
const ComboboxQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  options,
  placeholder = "Выберите вариант...",
  otherLabel = "Другое (указать свой)",
}: ComboboxQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value } }) => {
        const current = typeof value === "string" ? value : "";
        const isPreset = current !== "" && options.includes(current);
        const [isOther, setIsOther] = useState<boolean>(
          current !== "" && !isPreset,
        );
        const selectValue = isOther ? COMBOBOX_OTHER : isPreset ? current : "";

        return (
          <div>
            <h3 className="text-xl font-bold text-text-h mb-2">{title}</h3>
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
          </div>
        );
      }}
    />
  );
};

interface MultiSelectQuestionProps<
  T extends FieldValues,
> extends QuestionFieldProps<T> {
  options: SelectOptionItem[];
  placeholder?: string;
  /** Имя строкового поля формы для свободного ввода «Другое» на той же странице. */
  otherName?: Path<T>;
  otherLabel?: string;
  otherPlaceholder?: string;
}
const MultiSelectQuestion = <T extends FieldValues>({
  name,
  control,
  title,
  description,
  options,
  placeholder = "Добавить вариант...",
  otherName,
  otherLabel = "Другое — не из списка",
  otherPlaceholder = "Впишите свои варианты через запятую",
}: MultiSelectQuestionProps<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, value } }) => {
        const selected: number[] = Array.isArray(value) ? value : [];
        const available = options.filter((o) => !selected.includes(o.value));
        const labelOf = (v: number) =>
          options.find((o) => o.value === v)?.label ?? String(v);

        return (
          <div>
            <h3 className="text-xl font-bold text-text-h mb-2">{title}</h3>
            <p className="text-text mb-6">{description}</p>

            <select
              value=""
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v && !selected.includes(v)) onChange([...selected, v]);
              }}
              disabled={available.length === 0}
              className="w-full border border-border mt-6 rounded-lg p-3 bg-transparent text-current focus:outline-none focus:border-accent transition-colors cursor-pointer disabled:opacity-50"
            >
              <option value="" disabled>
                {available.length === 0 ? "Все варианты выбраны" : placeholder}
              </option>
              {available.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {selected.length > 0 && (
              <ol className="flex flex-col gap-2 mt-4">
                {selected.map((v, idx) => (
                  <li
                    key={v}
                    className="flex items-center justify-between gap-3 border border-border rounded-lg px-3 py-2"
                  >
                    <span className="text-text">
                      <span className="text-accent font-bold">{idx + 1}.</span>{" "}
                      {labelOf(v)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange(selected.filter((x) => x !== v))
                      }
                      className="text-text hover:text-accent cursor-pointer text-lg leading-none"
                      aria-label="Убрать"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            )}

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
          </div>
        );
      }}
    />
  );
};

const QuestionGratitude = () => {
  return (
    <motion.section
      className="flex flex-col items-center justify-center text-center p-8 space-y-6"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <HeartIcon className="w-24 h-24 text-accent text-red-500" />
      </motion.div>
      <h2 className="text-2xl font-bold">Спасибо за ваш отзыв!</h2>
    </motion.section>
  );
};

export {
  BooleanQuestion,
  ComboboxQuestion,
  CommonQuestion,
  MultiSelectQuestion,
  QuestionGratitude,
  RatingQuestion,
  SelectQuestion,
  TextQuestion,
  TextareaQuestion
};

