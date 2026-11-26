import type { JsonValue } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { FormFieldType, type FormField } from "@fesmu/contract/tasks/entity/service_form_pb";
import type { GetMyTaskResponse, MyTaskHistoryEvent } from "@fesmu/contract/tasks/service/task_service_pb";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useUserProvider } from "@/features/provider/user.provider";
import { taskClient } from "@/features/tasks/api";
import { CommonError } from "@/shared/components/state";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { TaskTime } from "./task-time";

type LoadState<T> = { status: "loading" | "error" | "missing" } | { status: "ready"; data: T };

function useTaskRequest<T>(request: (uuid: string, options: { signal: AbortSignal }) => Promise<T>, uuid: string) {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    request(uuid, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }).then(
      (data) => {
        if (!signal.aborted) setState({ status: "ready", data });
      },
      (error: unknown) => {
        if (!signal.aborted) {
          setState({ status: ConnectError.from(error).code === Code.NotFound ? "missing" : "error" });
        }
      },
    );
    return () => controller.abort();
  }, [request, uuid, attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }

  return { state, retry };
}

export default function MyTaskPage() {
  const { uuid = "" } = useParams<"uuid">();
  const { search } = useLocation();
  const applicantId = useUserProvider((state) => state.user?.uuid);

  return (
    <div className="w-full max-w-[1400px] min-w-0 space-y-5 px-3.5 pt-[17px] pb-8 min-[851px]:px-6 min-[851px]:pt-[23px] min-[851px]:pb-11">
      <Button asChild variant="outline" size="sm">
        <Link to={{ pathname: ROUTE.MY_TASKS, search }}>К списку заявок</Link>
      </Button>
      <MyTaskContent key={JSON.stringify([applicantId, uuid])} uuid={uuid} />
    </div>
  );
}

const getTask = (uuid: string, options: { signal: AbortSignal }) => taskClient.getMyTask({ uuid }, options);
const getHistory = (uuid: string, options: { signal: AbortSignal }) => taskClient.getMyTaskHistory({ uuid }, options);

function MyTaskContent({ uuid }: { uuid: string }) {
  const { state, retry } = useTaskRequest(getTask, uuid);

  if (state.status === "loading") {
    return <p role="status" className="text-sm text-muted-foreground">Загружаем заявку…</p>;
  }
  if (state.status === "missing") {
    return <h1 className="text-xl font-semibold">Заявка не найдена</h1>;
  }
  if (state.status !== "ready" || !state.data.task) {
    return <CommonError title="Не удалось загрузить заявку" onRetry={retry} />;
  }

  const { task } = state.data;
  return (
    <>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Заявка № {task.number}</p>
        <h1 className="wrap-anywhere text-[clamp(1.6rem,3vw,1.875rem)] leading-tight font-semibold tracking-[-0.035em]">
          {task.title}
        </h1>
      </div>
      <TaskDetails data={state.data} />
      <MyTaskHistory uuid={uuid} />
    </>
  );
}

function TaskDetails({ data: { task, serviceName, statusName, priorityName, formSchema } }: { data: GetMyTaskResponse }) {
  if (!task) return null;

  const fields = formSchema?.fields.flatMap((field) => {
    const value = task.extraFields && Object.hasOwn(task.extraFields, field.code)
      ? task.extraFields[field.code]
      : undefined;
    const text = formatFieldValue(field, value);
    return text === undefined ? [] : [{ code: field.code, name: field.name, text }];
  });

  return (
    <section aria-label="Данные заявки" className="space-y-5 rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:p-5">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Услуга">{serviceName}</Detail>
        <Detail label="Статус">{statusName}</Detail>
        <Detail label="Приоритет">{priorityName}</Detail>
        <Detail label="Дата подачи"><TaskTime value={task.createdAt} /></Detail>
        <Detail label="Последнее обновление"><TaskTime value={task.updatedAt} /></Detail>
      </dl>
      {task.description && (
        <div className="space-y-1 border-t pt-4">
          <h2 className="text-sm font-semibold">Описание</h2>
          <p className="text-sm whitespace-pre-wrap wrap-anywhere">{task.description}</p>
        </div>
      )}
      {!!fields?.length && (
        <div className="space-y-3 border-t pt-4">
          <h2 className="text-sm font-semibold">Дополнительные поля</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ code, name, text }) => <Detail key={code} label={name}>{text}</Detail>)}
          </dl>
        </div>
      )}
    </section>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1 text-sm wrap-anywhere">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{children || "—"}</dd>
    </div>
  );
}

const calendarDate = new Intl.DateTimeFormat("ru-RU", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});
const numberFormat = new Intl.NumberFormat("ru-RU", { maximumSignificantDigits: 21 });

function formatFieldValue(field: FormField, value?: JsonValue): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value ? "Да" : "Нет";
  if (typeof value === "number") return numberFormat.format(value);

  if (field.settings.case === "choice") {
    const options = field.settings.value.options;
    const label = (code: string) => options.find((option) => option.code === code)?.name ?? code;
    if (typeof value === "string") return label(value);
    if (Array.isArray(value)) return value.filter((item) => typeof item === "string").map(label).join(", ") || undefined;
  }

  if (typeof value === "string") {
    if (field.type === FormFieldType.DATE) {
      const date = new Date(value + "T00:00:00Z");
      if (!Number.isNaN(date.getTime())) return calendarDate.format(date);
    }
    return value;
  }

  return JSON.stringify(value);
}

function MyTaskHistory({ uuid }: { uuid: string }) {
  const { state, retry } = useTaskRequest(getHistory, uuid);

  return (
    <section aria-labelledby="task-history-title" className="space-y-3 rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:p-5">
      <h2 id="task-history-title" className="text-lg font-semibold">История заявки</h2>
      {state.status === "loading" && <p role="status" className="text-sm text-muted-foreground">Загружаем историю…</p>}
      {state.status === "missing" && <p className="text-sm text-muted-foreground">Заявка не найдена.</p>}
      {state.status === "error" && <CommonError title="Не удалось загрузить историю" onRetry={retry} />}
      {state.status === "ready" && <HistoryEvents events={state.data.events} />}
    </section>
  );
}

function HistoryEvents({ events }: { events: MyTaskHistoryEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">Событий пока нет.</p>;
  }

  return (
    <ol className="space-y-3 border-s pl-4">
      {events.map((event, index) => (
        <li key={index} className="space-y-0.5 text-sm">
          <p className="font-medium">{event.kind === "registered" ? "Заявка зарегистрирована" : "Событие заявки"}</p>
          <p className="text-muted-foreground"><TaskTime value={event.createdAt} /></p>
        </li>
      ))}
    </ol>
  );
}
