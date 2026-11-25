import { Code, ConnectError } from "@connectrpc/connect";
import { ArrowLeftIcon } from "lucide-react";
import { useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { listTaskDirections, taskCallOptions, taskCatalog } from "@/features/tasks/api";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import {
  DictionaryData,
  DictionaryFields,
  DictionaryForm,
  DictionaryHeading,
  SaveButton,
  dictionaryCard,
  dictionaryPage,
} from "./dictionary-shared";

export default function TaskServiceEditor() {
  const { serviceId } = useParams();

  if (
    serviceId &&
    (!/^[1-9]\d{0,18}$/.test(serviceId) || BigInt(serviceId) > 9223372036854775807n)
  ) {
    return (
      <div className={dictionaryPage}>
        <Link to={ROUTE.TASK_DICTIONARIES}>К справочникам</Link>
        <p>Услуга не найдена.</p>
      </div>
    );
  }

  return <ServiceEditor key={serviceId ?? "new"} id={serviceId ? BigInt(serviceId) : undefined} />;
}

function ServiceEditor({ id }: { id?: bigint }) {
  const navigate = useNavigate();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const [directions, reply] = await Promise.all([
        listTaskDirections(signal),
        id === undefined
          ? undefined
          : taskCatalog
              .getService({ id }, { ...taskCallOptions, signal })
              .catch((error: unknown) => {
                if (ConnectError.from(error).code !== Code.NotFound) throw error;
                return undefined;
              }),
      ]);
      return { directions, service: reply?.service };
    },
    [id],
  );

  return (
    <div className={dictionaryPage}>
      <div className="mx-auto max-w-[820px]">
        <Button asChild variant="ghost" className="mb-4">
          <Link to={ROUTE.TASK_DICTIONARIES}>
            <ArrowLeftIcon />К справочникам
          </Link>
        </Button>
        <DictionaryData load={load}>
          {({ directions, service }) =>
            id !== undefined && !service ? (
              <p className={dictionaryCard}>Услуга не найдена.</p>
            ) : (
              <>
                <DictionaryHeading
                  title={service?.name ?? "Создать услугу"}
                  description="Конструктор услуг"
                />
                {directions.length === 0 ? (
                  <div className={dictionaryCard}>
                    <p className="mb-3">Сначала добавьте направление.</p>
                    <Button asChild variant="outline">
                      <Link to={`${ROUTE.TASK_DICTIONARIES}?tab=directions`}>К направлениям</Link>
                    </Button>
                  </div>
                ) : (
                  <DictionaryForm
                    onSave={(values, fields) => {
                      const input = {
                        ...values,
                        directionId: BigInt(String(fields.get("directionId"))),
                        description: String(fields.get("description")).trim(),
                      };
                      return service
                        ? taskCatalog.updateService(
                            {
                              ...input,
                              id: service.id,
                              active: fields.has("active"),
                            },
                            taskCallOptions,
                          )
                        : taskCatalog.createService(input, taskCallOptions);
                    }}
                    onSaved={() => navigate(ROUTE.TASK_DICTIONARIES)}
                  >
                    {(saving) => (
                      <>
                        <section
                          className={`${dictionaryCard} grid gap-3`}
                          aria-labelledby="task-service-main"
                        >
                          <h2 id="task-service-main" className="text-lg font-semibold">
                            Основное
                          </h2>
                          <DictionaryFields entry={service} label="Название услуги">
                            <label className="grid min-w-0 gap-1.5 text-sm font-medium">
                              Направление
                              <select
                                name="directionId"
                                className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring"
                                defaultValue={service?.directionId.toString() ?? ""}
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
                            <input
                              type="checkbox"
                              name="active"
                              defaultChecked={service?.active ?? true}
                              disabled={!service}
                            />
                            Услуга активна
                          </label>
                        </section>
                        <div className="flex flex-wrap justify-between gap-2">
                          <Button asChild variant="ghost">
                            <Link to={ROUTE.TASK_DICTIONARIES}>К справочникам</Link>
                          </Button>
                          <SaveButton saving={saving} label="Сохранить услугу" />
                        </div>
                      </>
                    )}
                  </DictionaryForm>
                )}
              </>
            )
          }
        </DictionaryData>
      </div>
    </div>
  );
}
