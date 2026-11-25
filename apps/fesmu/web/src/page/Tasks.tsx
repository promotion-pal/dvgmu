import { useEffect, useState } from "react";
import type { Service } from "@fesmu/contract/tasks/entity/service_pb";
import { listTaskServices } from "@/features/tasks/api";
import { CommonControlState, CommonError } from "@/shared/components/state";

type CatalogState = { status: "loading" | "error" } | { status: "ready"; services: Service[] };

export default function TasksPage() {
  const [state, setState] = useState<CatalogState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    listTaskServices(signal).then(
      (services) => {
        if (!signal.aborted) {
          setState({ status: "ready", services: services.filter((service) => service.active) });
        }
      },
      () => {
        if (!signal.aborted) setState({ status: "error" });
      },
    );

    return () => controller.abort();
  }, [attempt]);

  const services = state.status === "ready" ? state.services : [];

  function retry() {
    setState({ status: "loading" });
    setAttempt((previous) => previous + 1);
  }

  return (
    <div className="w-full max-w-[1400px] min-w-0 px-3.5 pt-[17px] pb-8 min-[851px]:px-6 min-[851px]:pt-[23px] min-[851px]:pb-11">
      <div className="mb-[26px]">
        <h1 className="text-[clamp(1.6rem,3vw,1.875rem)] leading-tight font-semibold tracking-[-0.035em]">
          Заявки
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Университетские службы и ваши обращения
        </p>
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
          isEmpty={state.status === "ready" && services.length === 0}
          styleWrapper="min-h-0"
          loading={
            <p role="status" className="text-xs text-muted-foreground">Загружаем услуги…</p>
          }
          empty={
            <p role="status" className="text-xs text-muted-foreground">Услуги не найдены.</p>
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
          <p role="status" className="text-xs text-muted-foreground">
            Найдено услуг · {services.length}
          </p>
          <ul className="mt-2 grid gap-x-4 min-[851px]:grid-cols-2">
            {services.map((service) => (
              <li
                key={String(service.id)}
                className="min-w-0 wrap-anywhere border-b px-0.5 py-2.5 text-sm"
              >
                {service.name}
              </li>
            ))}
          </ul>
        </CommonControlState>
      </section>
    </div>
  );
}
