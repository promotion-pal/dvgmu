import { FormFieldType, type FormField } from "@fesmu/contract/tasks/entity/service_form_pb";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

export function TaskRequestField({ field, name }: { field: FormField; name: string }) {
  const { type, required, settings } = field;
  const label = field.name + (required ? " *" : "");
  const options = settings.case === "choice" ? settings.value.options : [];

  if (type === FormFieldType.MULTIPLE_CHOICE) {
    return (
      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        {options.map((option) => (
          <label key={option.code} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={option.code} />
            {option.name}
          </label>
        ))}
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

  if (type === FormFieldType.BOOLEAN || type === FormFieldType.SINGLE_CHOICE) {
    return (
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">
        {label}
        <select
          name={name}
          required={required}
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
      </label>
    );
  }

  let control;
  switch (type) {
    case FormFieldType.SHORT_TEXT:
      control = <Input name={name} required={required} />;
      break;
    case FormFieldType.LONG_TEXT:
      control = <Textarea name={name} required={required} rows={3} />;
      break;
    case FormFieldType.NUMBER: {
      const bounds = settings.case === "number" ? settings.value : undefined;
      control = (
        <Input
          name={name}
          type="number"
          required={required}
          step="any"
          min={bounds?.min}
          max={bounds?.max}
        />
      );
      break;
    }
    case FormFieldType.DATE:
      control = <Input name={name} type="date" required={required} />;
      break;
    default:
      return <p className="text-sm text-muted-foreground">Поле «{label}» недоступно.</p>;
  }

  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      {label}
      {control}
      {settings.case === "text" && (
        <span className="text-xs font-normal text-muted-foreground">
          Макс. {settings.value.maxLength} симв.
        </span>
      )}
    </label>
  );
}
