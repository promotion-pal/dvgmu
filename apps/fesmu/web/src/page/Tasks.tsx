import { useEffect, useState } from "react";
import type { Direction } from "@fesmu/contract/tasks/entity/direction_pb";
import type { Service } from "@fesmu/contract/tasks/entity/service_pb";
import type { CreateTaskRequest } from "@fesmu/contract/tasks/service/task_service_pb";
import { Link } from "react-router-dom";
import { useUserProvider } from "@/features/provider/user.provider";
import { listTaskDirections, listTaskServices } from "@/features/tasks/api";
import {
  clearPendingTask,
  pendingTaskKey,
  readPendingTask,
  savePendingTask,
} from "@/features/tasks/pending-task-submission";
import { TaskRequestDialog } from "@/features/tasks/task-request-dialog";
import { CommonControlState, CommonError } from "@/shared/components/state";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

type CatalogGroup = { direction: Direction; services: Service[] };
type CatalogState = { status: "loading" | "error" } | { status: "ready"; groups: CatalogGroup[] };

function byCatalogOrder(a: Direction | Service, b: Direction | Service) {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru");
}

async function loadCatalog(signal: AbortSignal) {
  const [directions, services] = await Promise.all([
    listTaskDirections(signal),
    listTaskServices(signal),
  ]);
  const groups = directions
    .filter(({ active }) => active)
    .sort(byCatalogOrder)
    .map((direction): CatalogGroup => ({ direction, services: [] }));
  const byDirection = new Map(groups.map((group) => [group.direction.id, group.services]));
  for (const service of services.filter(({ active }) => active).sort(byCatalogOrder)) {
    byDirection.get(service.directionId)?.push(service);
  }
  return groups;
}

export default function TasksPage() {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");
  const [directionId, setDirectionId] = useState("");
  const [pendingRequests, setPendingRequests] = useState(() => new Map<string, CreateTaskRequest>());
  const applicantId = useUserProvider((state) => state.user?.uuid);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    loadCatalog(signal).then(
      (groups) => {
        if (!signal.aborted) setState({ status: "ready", groups });
      },
      () => {
        if (!signal.aborted) setState({ status: "error" });
      },
    );

    return () => controller.abort();
  }, [attempt]);

  const groups = state.status === "ready" ? state.groups : [];
  const query = search.trim().toLocaleLowerCase("ru");
  const results = groups
    .filter(({ direction }) => !directionId || String(direction.id) === directionId)
    .map(({ direction, services }) => ({
      direction,
      services: services.filter(({ name }) => name.toLocaleLowerCase("ru").includes(query)),
    }))
    .filter(({ services }) => services.length > 0);
  const count = results.reduce((total, { services }) => total + services.length, 0);

  function retry() {
    setState({ status: "loading" });
    setAttempt((previous) => previous + 1);
  }

  function getPendingRequest(serviceId: bigint) {
    const storageKey = pendingTaskKey(applicantId, serviceId);
    return pendingRequests.get(storageKey ?? String(serviceId)) ?? readPendingTask(storageKey, serviceId);
  }

  function rememberRequest(request: CreateTaskRequest) {
    const storageKey = pendingTaskKey(applicantId, request.serviceId);
    const key = storageKey ?? String(request.serviceId);
    setPendingRequests((previous) => new Map(previous).set(key, request));
    savePendingTask(storageKey, request);
  }

  function forgetRequest(request: CreateTaskRequest) {
    const storageKey = pendingTaskKey(applicantId, request.serviceId);
    const key = storageKey ?? String(request.serviceId);
    setPendingRequests((previous) => {
      if (previous.get(key)?.idempotencyKey !== request.idempotencyKey) return previous;
      const next = new Map(previous);
      next.delete(key);
      return next;
    });
    clearPendingTask(storageKey, request);
  }

  return (
    <div className="w-full max-w-[1400px] min-w-0 px-3.5 pt-[17px] pb-8 min-[851px]:px-6 min-[851px]:pt-[23px] min-[851px]:pb-11">
      <div className="mb-[26px] flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[clamp(1.6rem,3vw,1.875rem)] leading-tight font-semibold tracking-[-0.035em]">
            Заявки
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Выберите университетскую услугу, чтобы подать заявку
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to={ROUTE.MY_TASKS}>Мои заявки</Link>
        </Button>
      </div>

      <section
        className="space-y-[9px] rounded-xl border bg-card p-4 text-card-foreground shadow-xs"
        aria-labelledby="tasks-catalog-title"
      >
        <h2 id="tasks-catalog-title" className="text-lg leading-[1.35] font-semibold">
          Каталог услуг
        </h2>
        <CommonControlState
          isLoading={state.status === "loading"}
          isError={state.status === "error"}
          isEmpty={false}
          styleWrapper="min-h-0"
          loading={
            <p role="status" className="text-xs text-muted-foreground">Загружаем услуги…</p>
          }
          error={
            <div role="alert">
              <CommonError
                title="Не удалось загрузить услуги"
                description="Проверьте, запущен ли локальный сервис заявок."
                onRetry={retry}
              />
            </div>
          }
        >
          {state.status === "ready" && (
            <div className="grid gap-4">
              <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                  Поиск по названию услуги
                  <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
                </label>
                <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                  Направление
                  <select
                    className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring"
                    value={directionId}
                    onChange={(event) => setDirectionId(event.target.value)}
                  >
                    <option value="">Все направления</option>
                    {groups.map(({ direction }) => (
                      <option key={String(direction.id)} value={String(direction.id)}>
                        {direction.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p role="status" className="text-xs text-muted-foreground">
                {count > 0 ? `Найдено услуг · ${count}` : "Услуги не найдены."}
              </p>
              {results.map(({ direction, services }) => (
                <div key={String(direction.id)}>
                  <h3 className="wrap-anywhere text-sm font-semibold">{direction.name}</h3>
                  <ul className="mt-1 grid gap-x-4 min-[851px]:grid-cols-2">
                    {services.map((service) => (
                      <li
                        key={String(service.id)}
                        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-0.5 py-2.5 text-sm"
                      >
                        <span className="min-w-0 wrap-anywhere font-medium">{service.name}</span>
                        <TaskRequestDialog
                          key={applicantId}
                          service={service}
                          getPendingRequest={getPendingRequest}
                          rememberRequest={rememberRequest}
                          forgetRequest={forgetRequest}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CommonControlState>
      </section>
    </div>
  );
}
