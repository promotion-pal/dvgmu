import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { MyTaskListItem, MyTasksCursor } from "@fesmu/contract/tasks/service/task_service_pb";
import { useEffect, useState } from "react";
import { generatePath, Link, useSearchParams } from "react-router-dom";
import { useUserProvider } from "@/features/provider/user.provider";
import { taskClient } from "@/features/tasks/api";
import { CommonError } from "@/shared/components/state";
import { ROUTE } from "@/shared/config/path";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { MyTaskFilters } from "./my-task-filters";
import { TaskTime } from "./task-time";

type ListState = {
  status: "loading" | "ready" | "error";
  tasks: MyTaskListItem[];
  nextCursor?: MyTasksCursor;
};

function readId(params: URLSearchParams, key: string) {
  const value = params.get(key);
  if (!value || !/^[1-9]\d{0,18}$/.test(value)) return undefined;
  const id = BigInt(value);
  return id <= 9223372036854775807n ? id : undefined;
}

function readDate(params: URLSearchParams, key: string, exclusive = false) {
  const value = params.get(key);
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return undefined;
  if (exclusive) date.setDate(date.getDate() + 1);
  return timestampFromDate(date);
}

export default function MyTasksPage() {
  const [params] = useSearchParams();
  const applicantId = useUserProvider((state) => state.user?.uuid);
  const query = params.toString();

  return (
    <div className="w-full max-w-[1400px] min-w-0 space-y-5 px-3.5 pt-[17px] pb-8 min-[851px]:px-6 min-[851px]:pt-[23px] min-[851px]:pb-11">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-[clamp(1.6rem,3vw,1.875rem)] leading-tight font-semibold tracking-[-0.035em]">
          Мои заявки
        </h1>
        <Button asChild variant="outline">
          <Link to={ROUTE.TASKS}>Каталог услуг</Link>
        </Button>
      </div>
      <MyTaskFilters />
      <MyTaskList key={JSON.stringify([applicantId, query])} query={query} />
    </div>
  );
}

function MyTaskList({ query }: { query: string }) {
  const [state, setState] = useState<ListState>({ status: "loading", tasks: [] });
  const [page, setPage] = useState<{ after?: MyTasksCursor }>({});

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const params = new URLSearchParams(query);
    const request = {
      pageSize: 20,
      after: page.after,
      serviceId: readId(params, "serviceId"),
      statusId: readId(params, "statusId"),
      priorityId: readId(params, "priorityId"),
      createdFrom: readDate(params, "createdFrom"),
      createdBefore: readDate(params, "createdTo", true),
    };

    taskClient.listMyTasks(request, { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }).then(
      ({ tasks, nextCursor }) => {
        if (!signal.aborted) {
          setState((previous) => ({
            status: "ready",
            tasks: [...previous.tasks, ...tasks],
            nextCursor,
          }));
        }
      },
      () => {
        if (!signal.aborted) setState((previous) => ({ ...previous, status: "error" }));
      },
    );

    return () => controller.abort();
  }, [page, query]);

  function load(after?: MyTasksCursor) {
    setState((previous) => ({ ...previous, status: "loading" }));
    setPage({ after });
  }

  if (!state.tasks.length) {
    if (state.status === "loading") {
      return <p role="status" className="text-sm text-muted-foreground">Загружаем заявки…</p>;
    }
    if (state.status === "error") {
      return <CommonError title="Не удалось загрузить заявки" onRetry={() => load()} />;
    }
    if (!state.nextCursor) {
      return (
        <p role="status" className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          {query ? "По этим фильтрам заявки не найдены." : "У вас пока нет заявок."}
        </p>
      );
    }
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-xl border bg-card text-card-foreground shadow-xs" aria-label="Список заявок">
        {state.tasks.map((task) => (
          <li key={task.uuid} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)] sm:gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">№ {task.number}</p>
              <Link
                to={{ pathname: generatePath(ROUTE.MY_TASK, { uuid: task.uuid }), search: query }}
                className="wrap-anywhere text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {task.title}
              </Link>
              <p className="wrap-anywhere text-sm text-muted-foreground">{task.serviceName}</p>
            </div>
            <div className="grid content-start gap-1 text-sm">
              <div><Badge variant="secondary" className="h-auto max-w-full whitespace-normal wrap-anywhere">{task.statusName}</Badge></div>
              <p className="wrap-anywhere text-muted-foreground">Приоритет · {task.priorityName}</p>
              <p className="text-muted-foreground">Подана <TaskTime value={task.createdAt} /></p>
            </div>
          </li>
        ))}
      </ul>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">Не удалось загрузить следующую страницу.</p>
      )}
      {state.nextCursor && (
        <Button
          variant="outline"
          disabled={state.status === "loading"}
          onClick={() => load(state.nextCursor)}
        >
          {state.status === "loading" ? "Загружаем…" : state.status === "error" ? "Повторить" : "Показать ещё"}
        </Button>
      )}
    </div>
  );
}
