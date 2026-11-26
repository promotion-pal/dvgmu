import { useEffect, useId, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { listTaskPriorities, listTaskServices, listTaskStatuses } from "@/features/tasks/api";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

const dictionaryFilters = [
  { name: "serviceId", label: "Услуга", all: "Все услуги", load: listTaskServices },
  { name: "statusId", label: "Статус", all: "Все статусы", load: listTaskStatuses },
  { name: "priorityId", label: "Приоритет", all: "Все приоритеты", load: listTaskPriorities },
] as const;
const dateFilters = [
  { name: "createdFrom", label: "Дата подачи с" },
  { name: "createdTo", label: "Дата подачи по" },
] as const;

export function MyTaskFilters() {
  const [params, setParams] = useSearchParams();
  const [invalidRange, setInvalidRange] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const fieldsKey = JSON.stringify([params.toString(), resetCount]);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const from = String(data.get("createdFrom") ?? "");
    const to = String(data.get("createdTo") ?? "");
    if (from && to && from > to) {
      setInvalidRange(true);
      return;
    }
    setInvalidRange(false);
    const next = new URLSearchParams();
    for (const { name } of [...dictionaryFilters, ...dateFilters]) {
      const value = data.get(name);
      if (typeof value === "string" && value) next.set(name, value);
    }
    setParams(next);
  }

  function reset() {
    setInvalidRange(false);
    setResetCount((count) => count + 1);
    setParams({});
  }

  return (
    <form
      aria-label="Фильтры заявок"
      className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
      onSubmit={apply}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {dictionaryFilters.map(({ name, ...filter }) => (
          <DictionaryFilter key={name} name={name} value={params.get(name) ?? ""} fieldsKey={fieldsKey} {...filter} />
        ))}
        {dateFilters.map(({ name, label }) => (
          <label key={name} className="grid min-w-0 content-start gap-1.5 text-sm font-medium">
            {label}
            <Input
              key={fieldsKey}
              type="date"
              name={name}
              defaultValue={params.get(name) ?? ""}
              aria-invalid={invalidRange || undefined}
              aria-describedby={invalidRange ? "my-tasks-date-error" : undefined}
              onChange={() => setInvalidRange(false)}
            />
          </label>
        ))}
      </div>
      {invalidRange && (
        <p id="my-tasks-date-error" role="alert" className="text-sm text-destructive">
          Начало периода должно быть не позже его окончания.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm">Применить</Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>Сбросить</Button>
      </div>
    </form>
  );
}

type Option = { id: bigint; name: string };

function DictionaryFilter({ name, label, all, load, value, fieldsKey }: {
  name: string;
  label: string;
  all: string;
  load: (signal: AbortSignal) => Promise<Option[]>;
  value: string;
  fieldsKey: string;
}) {
  const [options, setOptions] = useState<Option[]>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const id = useId();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    load(signal).then(
      (items) => {
        if (!signal.aborted) {
          setOptions([...items].sort((a, b) => a.name.localeCompare(b.name, "ru")));
        }
      },
      () => {
        if (!signal.aborted) setError(true);
      },
    );
    return () => controller.abort();
  }, [load, attempt]);

  return (
    <div className="grid min-w-0 content-start gap-1.5 text-sm">
      <label htmlFor={id} className="font-medium">{label}</label>
      <DictionarySelect key={fieldsKey} id={id} name={name} label={label} all={all} initialValue={value} options={options} />
      {error && (
        <div role="alert" className="text-xs text-muted-foreground">
          Справочник недоступен.{" "}
          <button
            type="button"
            className="text-primary underline"
            onClick={() => {
              setError(false);
              setAttempt((count) => count + 1);
            }}
          >
            Повторить
          </button>
        </div>
      )}
    </div>
  );
}

function DictionarySelect({ id, name, label, all, initialValue, options }: {
  id: string;
  name: string;
  label: string;
  all: string;
  initialValue: string;
  options?: Option[];
}) {
  const [value, setValue] = useState(initialValue);

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-2.5 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <option value="">{all}</option>
      {value && !options?.some(({ id }) => String(id) === value) && (
        <option value={value}>{label} № {value}</option>
      )}
      {options?.map(({ id, name }) => <option key={String(id)} value={String(id)}>{name}</option>)}
    </select>
  );
}
