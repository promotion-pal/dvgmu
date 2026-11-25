import { create } from "@bufbuild/protobuf";
import {
  FormChoiceOptionSchema,
  FormChoiceSettingsSchema,
  FormFieldSchema,
  FormFieldType,
  type FormChoiceOption,
  type FormField,
} from "@fesmu/contract/tasks/entity/service_form_pb";
import { PlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { dictionaryCard } from "./dictionary-shared";

export const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring";
const labelClass = "grid min-w-0 gap-1.5 text-sm font-medium";
const itemClass = "grid min-w-0 gap-3 rounded-lg border bg-background p-3";
const fieldTypes = [
  [FormFieldType.SHORT_TEXT, "Строка"],
  [FormFieldType.LONG_TEXT, "Текст"],
  [FormFieldType.NUMBER, "Число"],
  [FormFieldType.DATE, "Дата"],
  [FormFieldType.BOOLEAN, "Да / нет"],
  [FormFieldType.SINGLE_CHOICE, "Список значений"],
  [FormFieldType.MULTIPLE_CHOICE, "Список с множественным выбором"],
] as const;

function newCode(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return prefix + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ServiceFormFields({
  fields,
  onChange,
}: {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}) {
  function addField() {
    const lastOrder = fields.reduce((max, field) => Math.max(max, field.sortOrder), -1);
    const field = create(FormFieldSchema, {
      code: newCode("field-"),
      type: FormFieldType.SHORT_TEXT,
      required: false,
      sortOrder: Math.min(lastOrder + 1, 2147483647),
    });
    onChange([...fields, field]);
  }

  return (
    <section className={`${dictionaryCard} grid gap-3`} aria-labelledby="task-service-fields">
      <h2 id="task-service-fields" className="text-lg font-semibold">
        Поля формы
      </h2>
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">Дополнительных полей пока нет.</p>
      )}
      {fields.map((field, index) => (
        <FieldEditor
          key={field.code}
          field={field}
          index={index}
          onChange={(updated) =>
            onChange(fields.map((item) => (item.code === field.code ? updated : item)))
          }
          onRemove={() => onChange(fields.filter((item) => item.code !== field.code))}
        />
      ))}
      <Button variant="outline" type="button" className="w-fit" onClick={addField}>
        <PlusIcon />
        Добавить поле
      </Button>
    </section>
  );
}

function FieldEditor({
  field,
  index,
  onChange,
  onRemove,
}: {
  field: FormField;
  index: number;
  onChange: (field: FormField) => void;
  onRemove: () => void;
}) {
  const { settings } = field;

  function changeType(type: FormFieldType) {
    const isChoice = type === FormFieldType.SINGLE_CHOICE || type === FormFieldType.MULTIPLE_CHOICE;
    const isText = type === FormFieldType.SHORT_TEXT || type === FormFieldType.LONG_TEXT;
    let nextSettings: FormField["settings"] = { case: undefined };
    if (isChoice) {
      nextSettings =
        settings.case === "choice"
          ? settings
          : {
              case: "choice",
              value: create(FormChoiceSettingsSchema),
            };
    } else if (isText && settings.case === "text") {
      nextSettings = settings;
    }
    onChange({ ...field, type, settings: nextSettings });
  }

  return (
    <div className={itemClass} role="group" aria-label={`Поле ${index + 1}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Название поля
          <Input
            value={field.name}
            onChange={(event) => onChange({ ...field, name: event.target.value })}
            maxLength={150}
            required
          />
        </label>
        <label className={labelClass}>
          Тип поля
          <select
            className={selectClass}
            value={field.type}
            onChange={(event) => changeType(Number(event.target.value))}
          >
            {field.type === FormFieldType.ATTACHMENT && (
              <option value={FormFieldType.ATTACHMENT}>Вложение</option>
            )}
            {fieldTypes.map(([type, label]) => (
              <option key={type} value={type}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {settings.case === "choice" && (
        <ChoiceEditor
          options={settings.value.options}
          onChange={(options) =>
            onChange({
              ...field,
              settings: { case: "choice", value: { ...settings.value, options } },
            })
          }
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex w-fit items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(event) => onChange({ ...field, required: event.target.checked })}
          />
          Обязательное поле
        </label>
        <Button type="button" variant="ghost" className="text-destructive" onClick={onRemove}>
          Удалить поле
        </Button>
      </div>
    </div>
  );
}

function ChoiceEditor({
  options,
  onChange,
}: {
  options: FormChoiceOption[];
  onChange: (options: FormChoiceOption[]) => void;
}) {
  return (
    <div className="grid gap-2" role="group" aria-label="Варианты списка">
      {options.map(({ code, name }, index) => (
        <div key={code} className="flex flex-wrap items-end gap-2">
          <label className={`${labelClass} flex-1`}>
            Вариант {index + 1}
            <Input
              value={name}
              maxLength={150}
              required
              onChange={(event) =>
                onChange(
                  options.map((item) =>
                    item.code === code ? { ...item, name: event.target.value } : item,
                  ),
                )
              }
            />
          </label>
          <Button
            variant="ghost"
            type="button"
            className="text-destructive"
            onClick={() => onChange(options.filter((item) => item.code !== code))}
            aria-label={`Удалить вариант ${index + 1}`}
          >
            Удалить
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        type="button"
        size="sm"
        className="w-fit"
        onClick={() =>
          onChange([...options, create(FormChoiceOptionSchema, { code: newCode("option-") })])
        }
      >
        <PlusIcon />
        Добавить вариант
      </Button>
    </div>
  );
}

type RouteDraft = { key: string; applicantDepartmentId: string; queueId: string; active: boolean };

export function ServiceRouteFields({
  routes,
  onChange,
}: {
  routes: RouteDraft[];
  onChange: (routes: RouteDraft[]) => void;
}) {
  function updateRoute(key: string, change: Partial<RouteDraft>) {
    onChange(routes.map((route) => (route.key === key ? { ...route, ...change } : route)));
  }

  return (
    <section className={`${dictionaryCard} grid gap-3`} aria-labelledby="task-service-routing">
      <h2 id="task-service-routing" className="text-lg font-semibold">
        Маршрутизация
      </h2>
      <p className="text-sm text-muted-foreground">
        Оставьте ID подразделения пустым для маршрута по умолчанию. Если подходящей очереди нет или
        их несколько, заявка попадёт в очередь разбора.
      </p>
      {routes.map((route, index) => (
        <div key={route.key} className={itemClass} role="group" aria-label={`Маршрут ${index + 1}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              ID подразделения заявителя
              <Input
                value={route.applicantDepartmentId}
                placeholder="Любое подразделение"
                onChange={(event) =>
                  updateRoute(route.key, { applicantDepartmentId: event.target.value })
                }
              />
            </label>
            <label className={labelClass}>
              ID очереди
              <Input
                value={route.queueId}
                required
                onChange={(event) => updateRoute(route.key, { queueId: event.target.value })}
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex w-fit items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={route.active}
                onChange={(event) => updateRoute(route.key, { active: event.target.checked })}
              />
              Маршрут активен
            </label>
            <Button
              variant="ghost"
              type="button"
              className="text-destructive"
              onClick={() => onChange(routes.filter(({ key }) => key !== route.key))}
            >
              Удалить маршрут
            </Button>
          </div>
        </div>
      ))}
      <Button
        variant="outline"
        type="button"
        className="w-fit"
        onClick={() =>
          onChange([
            ...routes,
            { key: newCode("route-"), applicantDepartmentId: "", queueId: "", active: true },
          ])
        }
      >
        <PlusIcon />
        Добавить маршрут
      </Button>
    </section>
  );
}
