import { Code, ConnectError } from "@connectrpc/connect";
import { ArrowLeftIcon } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  listTaskDirections,
  listTaskPriorities,
  listTaskStatuses,
  taskCallOptions,
  taskCatalog,
} from "@/features/tasks/api";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  DictionaryData,
  DictionaryFields,
  DictionaryHeading,
  SaveButton,
  dictionaryCard,
  dictionaryPage,
} from "./dictionary-shared";
import { ServiceFormFields, ServiceRouteFields, selectClass } from "./service-configuration-fields";

async function loadConfiguration(id: bigint | undefined, signal: AbortSignal) {
  const [directions, statuses, priorities, configuration] = await Promise.all([
    listTaskDirections(signal),
    listTaskStatuses(signal),
    listTaskPriorities(signal),
    id === undefined
      ? undefined
      : taskCatalog
          .getServiceConfiguration({ serviceId: id }, { ...taskCallOptions, signal })
          .catch((error: unknown) => {
            if (ConnectError.from(error).code !== Code.NotFound) throw error;
            return undefined;
          }),
  ]);
  return { directions, statuses, priorities, configuration };
}

type EditorData = Awaited<ReturnType<typeof loadConfiguration>>;

export default function TaskServiceEditor() {
  const { serviceId } = useParams();
  const id = serviceId && /^[1-9]\d{0,18}$/.test(serviceId) ? BigInt(serviceId) : undefined;
  const invalid = serviceId !== undefined && (id === undefined || id > 9223372036854775807n);
  const load = useCallback((signal: AbortSignal) => loadConfiguration(id, signal), [id]);

  return (
    <div className={dictionaryPage}>
      <div className="mx-auto max-w-[820px]">
        <Button asChild variant="ghost" className="mb-4">
          <Link to={ROUTE.TASK_DICTIONARIES}>
            <ArrowLeftIcon />К справочникам
          </Link>
        </Button>
        {invalid ? (
          <p className={dictionaryCard}>Услуга не найдена.</p>
        ) : (
          <DictionaryData key={serviceId ?? "new"} load={load}>
            {(data) => <LoadedEditor initialData={data} id={id} load={load} />}
          </DictionaryData>
        )}
      </div>
    </div>
  );
}

function LoadedEditor({
  initialData,
  id,
  load,
}: {
  initialData: EditorData;
  id?: bigint;
  load: (signal: AbortSignal) => Promise<EditorData>;
}) {
  const [snapshot, setSnapshot] = useState({ data: initialData, revision: 0 });
  const { data } = snapshot;
  const service = data.configuration?.service;
  if (id !== undefined && !service) {
    return <p className={dictionaryCard}>Услуга не найдена.</p>;
  }

  async function reload() {
    const data = await load(AbortSignal.timeout(15000));
    setSnapshot((previous) => ({ data, revision: previous.revision + 1 }));
  }

  return (
    <>
      <DictionaryHeading
        title={service?.name ?? "Создать услугу"}
        description="Конструктор услуг"
      />
      {data.directions.length === 0 ? (
        <div className={dictionaryCard}>
          <p className="mb-3">Сначала добавьте направление.</p>
          <Button asChild variant="outline">
            <Link to={`${ROUTE.TASK_DICTIONARIES}?tab=directions`}>К направлениям</Link>
          </Button>
        </div>
      ) : (
        <EditorForm key={snapshot.revision} data={data} reload={reload} />
      )}
    </>
  );
}

function EditorForm({ data, reload }: { data: EditorData; reload: () => Promise<void> }) {
  const navigate = useNavigate();
  const { directions, statuses, priorities, configuration } = data;
  const service = configuration?.service;
  const defaults = configuration?.settings;
  const [fields, setFields] = useState(configuration?.form?.fields ?? []);
  const [routes, setRoutes] = useState(() =>
    (configuration?.routes ?? []).map(({ applicantDepartmentId, queueId, active }, index) => ({
      key: String(index),
      applicantDepartmentId,
      queueId,
      active: active !== false,
    })),
  );
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [pending, setPending] = useState<"save" | "reload" | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || conflict) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name")).trim();
    const initialStatusId = BigInt(String(form.get("initialStatusId") ?? ""));
    const defaultPriorityId = BigInt(String(form.get("defaultPriorityId") ?? ""));
    if (!name) return setError("Укажите название услуги.");
    if ((initialStatusId === 0n) !== (defaultPriorityId === 0n)) {
      return setError("Выберите начальный статус и приоритет по умолчанию.");
    }
    if (fields.some((field) => !field.name.trim())) return setError("Заполните названия полей.");
    if (
      fields.some(
        ({ settings }) =>
          settings.case === "choice" &&
          (!settings.value.options.length ||
            settings.value.options.some(({ name }) => !name.trim())),
      )
    ) {
      return setError("Добавьте и заполните варианты для каждого списка значений.");
    }
    if (routes.some(({ queueId }) => !queueId.trim()))
      return setError("Укажите ID каждой очереди.");
    const routeKeys = routes.map(({ queueId, applicantDepartmentId }) =>
      JSON.stringify([applicantDepartmentId.trim(), queueId.trim()]),
    );
    if (new Set(routeKeys).size !== routes.length)
      return setError("Удалите повторяющиеся маршруты.");

    // Submit one snapshot so a conflict or validation error cannot partially save the service.
    const input = {
      service: {
        id: service?.id ?? 0n,
        name,
        code: String(form.get("code")),
        directionId: BigInt(String(form.get("directionId"))),
        description: String(form.get("description")).trim(),
        sortOrder: Number(form.get("sortOrder")),
        active: form.has("active"),
      },
      form: { fields },
      settings: initialStatusId ? { initialStatusId, defaultPriorityId } : undefined,
      routes: routes.map(({ applicantDepartmentId, queueId, active }) => ({
        applicantDepartmentId,
        queueId,
        active,
      })),
      expectedVersion: configuration?.version ?? "",
    };
    setPending("save");
    setError("");
    try {
      await taskCatalog.saveServiceConfiguration(input, taskCallOptions);
      navigate(ROUTE.TASK_DICTIONARIES);
    } catch (cause) {
      if (ConnectError.from(cause).code === Code.Aborted) setConflict(true);
      else setError(saveError(cause));
    } finally {
      setPending(null);
    }
  }

  async function refresh() {
    setPending("reload");
    setError("");
    try {
      await reload();
    } catch {
      setError("Не удалось загрузить актуальные настройки. Попробуйте ещё раз.");
      setPending(null);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset className="grid min-w-0 gap-3" disabled={pending !== null}>
        <section className={`${dictionaryCard} grid gap-3`} aria-labelledby="task-service-main">
          <h2 id="task-service-main" className="text-lg font-semibold">
            Основное
          </h2>
          <DictionaryFields entry={service} label="Название услуги">
            <label className="grid min-w-0 gap-1.5 text-sm font-medium">
              Направление
              <select
                name="directionId"
                className={selectClass}
                defaultValue={String(service?.directionId ?? "")}
                required
              >
                <option value="" disabled>
                  Выберите направление
                </option>
                {directions.map((direction) => (
                  <option key={String(direction.id)} value={String(direction.id)}>
                    {direction.name}
                  </option>
                ))}
              </select>
            </label>
          </DictionaryFields>
          <label className="grid gap-1.5 text-sm font-medium">
            Описание
            <Textarea name="description" defaultValue={service?.description} />
          </label>
          <label className="flex w-fit items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={service?.active ?? true} />
            Услуга активна
          </label>
        </section>
        <ServiceFormFields fields={fields} onChange={setFields} />
        <ServiceRouteFields routes={routes} onChange={setRoutes} />
        <section className={`${dictionaryCard} grid gap-3`} aria-labelledby="task-service-defaults">
          <h2 id="task-service-defaults" className="text-lg font-semibold">
            Настройки новой заявки
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <DefaultSelect
              name="initialStatusId"
              label="Начальный статус"
              options={statuses}
              selected={defaults?.initialStatusId}
            />
            <DefaultSelect
              name="defaultPriorityId"
              label="Приоритет по умолчанию"
              options={priorities}
              selected={defaults?.defaultPriorityId}
            />
          </div>
          {!defaults && (
            <p className="text-sm text-muted-foreground">
              Чтобы по услуге можно было подавать заявки, задайте начальный статус и приоритет.
            </p>
          )}
        </section>
        {conflict && (
          <div className="grid gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <p role="alert" className="text-sm">
              Настройки услуги уже изменились. Загрузите актуальную версию, чтобы продолжить. При
              обновлении несохранённые изменения будут сброшены.
            </p>
            <Button className="w-fit" type="button" variant="outline" onClick={refresh}>
              {pending === "reload" ? "Обновляем…" : "Обновить настройки"}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-between gap-2">
          <Button asChild variant="ghost">
            <Link to={ROUTE.TASK_DICTIONARIES}>К справочникам</Link>
          </Button>
          <SaveButton saving={pending === "save"} label="Сохранить услугу" disabled={conflict} />
        </div>
      </fieldset>
    </form>
  );
}

function DefaultSelect({
  name,
  label,
  options,
  selected,
}: {
  name: string;
  label: string;
  options: { id: bigint; name: string; active?: boolean }[];
  selected?: bigint;
}) {
  const available = options.filter(({ id, active }) => active || id === selected);
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      {label}
      <select name={name} className={selectClass} defaultValue={selected?.toString() ?? ""}>
        <option value="" disabled={selected !== undefined}>
          {available.length ? "Не выбрано" : "Нет активных записей в справочнике"}
        </option>
        {available.map(({ id, name, active }) => (
          <option key={String(id)} value={String(id)}>
            {name}
            {active ? "" : " (неактивен)"}
          </option>
        ))}
      </select>
    </label>
  );
}

function saveError(error: unknown) {
  switch (ConnectError.from(error).code) {
    case Code.AlreadyExists:
      return "В этом направлении уже есть услуга с таким кодом.";
    case Code.InvalidArgument:
      return "Проверьте основные сведения, поля формы и маршруты.";
    case Code.FailedPrecondition:
      return "Проверьте, что направление, начальный статус и приоритет доступны.";
    case Code.NotFound:
      return "Услуга больше недоступна. Обновите страницу.";
    default:
      return "Не удалось сохранить настройки услуги. Попробуйте ещё раз.";
  }
}
