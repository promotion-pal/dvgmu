import { Code, ConnectError } from "@connectrpc/connect";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CommonControlState, CommonError } from "@/shared/components/state";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

export const dictionaryPage = "w-full max-w-[1400px] min-w-0 px-3.5 py-5 min-[851px]:px-6";
export const dictionaryCard = "min-w-0 rounded-xl border bg-card p-4 shadow-xs";

export function DictionaryHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-[26px] flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-[clamp(1.6rem,3vw,1.875rem)] leading-tight font-semibold tracking-[-0.035em]">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

type LoadState<T> = { status: "loading" | "error" } | { status: "ready"; value: T };

export function DictionaryData<T>({
  load,
  children,
}: {
  load: (signal: AbortSignal) => Promise<T>;
  children: (value: T) => ReactNode;
}) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    load(signal).then(
      (value) => {
        if (!signal.aborted) setState({ status: "ready", value });
      },
      () => {
        if (!signal.aborted) setState({ status: "error" });
      },
    );

    return () => controller.abort();
  }, [load, attempt]);

  return (
    <CommonControlState
      isLoading={state.status === "loading"}
      isError={state.status === "error"}
      isEmpty={false}
      styleWrapper="min-h-0"
      loading={
        <p role="status" className="text-sm text-muted-foreground">
          Загрузка…
        </p>
      }
      error={
        <div role="alert">
          <CommonError
            title="Не удалось загрузить данные"
            description="Проверьте, запущен ли локальный сервис заявок."
            onRetry={() => {
              setState({ status: "loading" });
              setAttempt((previous) => previous + 1);
            }}
          />
        </div>
      }
    >
      {state.status === "ready" && children(state.value)}
    </CommonControlState>
  );
}

export type DictionaryValues = { name: string; code: string; sortOrder: number };

export function DictionaryFields({
  entry,
  label,
  children,
}: {
  entry?: DictionaryValues;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">
        {label}
        <Input name="name" defaultValue={entry?.name} maxLength={150} required />
      </label>
      {children}
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">
        Код
        <Input
          name="code"
          defaultValue={entry?.code}
          maxLength={64}
          pattern="[a-z0-9][a-z0-9_\-]{0,63}"
          title="Строчные латинские буквы, цифры, дефис или подчёркивание"
          required
        />
      </label>
      <label className="grid min-w-0 gap-1.5 text-sm font-medium">
        Порядок сортировки
        <Input
          name="sortOrder"
          type="number"
          min={-2147483648}
          max={2147483647}
          step={1}
          defaultValue={entry?.sortOrder ?? 0}
          required
        />
      </label>
    </div>
  );
}

function saveError(error: unknown) {
  switch (ConnectError.from(error).code) {
    case Code.AlreadyExists:
      return "Запись с таким кодом уже существует.";
    case Code.InvalidArgument:
      return "Проверьте название, код и остальные поля.";
    case Code.NotFound:
      return "Запись больше недоступна. Обновите страницу.";
    default:
      return "Не удалось сохранить изменения. Попробуйте ещё раз.";
  }
}

export function DictionaryForm({
  className,
  onSave,
  onSaved,
  children,
}: {
  className?: string;
  onSave: (values: DictionaryValues, fields: FormData) => Promise<unknown>;
  onSaved: () => void;
  children: (saving: boolean) => ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name")).trim();
    if (!name) {
      setError("Укажите название.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave(
        {
          name,
          code: String(data.get("code")),
          sortOrder: Number(data.get("sortOrder")),
        },
        data,
      );
    } catch (cause) {
      setError(saveError(cause));
      setSaving(false);
      return;
    }
    form.reset();
    setSaving(false);
    onSaved();
  }

  return (
    <form className={className} onSubmit={submit}>
      <fieldset disabled={saving} className="grid min-w-0 gap-3">
        {children(saving)}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </fieldset>
    </form>
  );
}

export function SaveButton({ saving, label = "Сохранить" }: { saving: boolean; label?: string }) {
  return <Button type="submit">{saving ? "Сохраняем…" : label}</Button>;
}
