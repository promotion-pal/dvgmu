import { FormFieldType, type FormField } from "@fesmu/contract/tasks/entity/service_form_pb";
import { useId } from "react";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

export function TaskRequestField({ field, name, error }: { field: FormField; name: string; error?: string }) {
  const { type, required, settings } = field;
  const label = field.name + (required ? " *" : "");
  const options = settings.case === "choice" ? settings.value.options : [];
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  const errorMessage = error && (
    <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>
  );

  if (type === FormFieldType.MULTIPLE_CHOICE) {
    return (
      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        {options.map((option, index) => (
          <label key={option.code} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={option.code}
              aria-invalid={error && index === 0 ? true : undefined}
              aria-describedby={index === 0 ? errorId : undefined}
            />
            {option.name}
          </label>
        ))}
        {errorMessage}
      </fieldset>
    );
  }

  if (type === FormFieldType.ATTACHMENT) {
    return (
      <div className="grid gap-1 text-sm">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">Прикрепление файлов пока недоступно.</p>
      </div>
    );
  }

  const bounds = settings.case === "number" ? settings.value : undefined;
  const hint = settings.case === "text"
    ? `Макс. ${settings.value.maxLength} симв.`
    : [bounds?.min !== undefined ? `от ${bounds.min}` : "", bounds?.max !== undefined ? `до ${bounds.max}` : ""]
      .filter(Boolean).join(" ");
  const hintId = hint ? `${id}-hint` : undefined;
  const controlProps = {
    name,
    required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [hintId, errorId].filter(Boolean).join(" ") || undefined,
  };

  let control;
  if (type === FormFieldType.BOOLEAN || type === FormFieldType.SINGLE_CHOICE) {
    control = (
      <select
        {...controlProps}
        defaultValue=""
        className="h-9 w-full rounded-md border border-input bg-background px-2.5 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Выберите значение</option>
        {type === FormFieldType.BOOLEAN ? (
          <>
            <option value="true">Да</option>
            <option value="false">Нет</option>
          </>
        ) : (
          options.map((option) => (
            <option key={option.code} value={option.code}>{option.name}</option>
          ))
        )}
      </select>
    );
  } else {
    switch (type) {
      case FormFieldType.SHORT_TEXT:
        control = <Input {...controlProps} />;
        break;
      case FormFieldType.LONG_TEXT:
        control = <Textarea {...controlProps} rows={3} />;
        break;
      case FormFieldType.NUMBER:
        control = <Input {...controlProps} type="number" step="any" min={bounds?.min} max={bounds?.max} />;
        break;
      case FormFieldType.DATE:
        control = <Input {...controlProps} type="date" />;
        break;
      default:
        return <p className="text-sm text-muted-foreground">Поле «{label}» недоступно.</p>;
    }
  }

  return (
    <div className="grid min-w-0 gap-1.5">
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">
        {label}
        {control}
      </label>
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      )}
      {errorMessage}
    </div>
  );
}
