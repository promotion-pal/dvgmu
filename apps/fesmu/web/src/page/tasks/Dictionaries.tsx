import { PlusIcon } from "lucide-react";
import { Tabs } from "radix-ui";
import { useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  listTaskDirections,
  listTaskPriorities,
  listTaskServices,
  listTaskStatuses,
  taskCallOptions,
  taskDirections,
  taskPriorities,
  taskServiceRoutes,
  taskStatuses,
} from "@/features/tasks/api";
import { ROUTE } from "@/shared/config/path";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  DictionaryData,
  DictionaryFields,
  DictionaryForm,
  DictionaryHeading,
  SaveButton,
  dictionaryCard,
  dictionaryPage,
  type DictionaryValues,
} from "./dictionary-shared";
import "./dictionaries.css";

const tabs = [
  { value: "services", label: "Услуги" },
  { value: "directions", label: "Направления" },
  { value: "statuses", label: "Статусы" },
  { value: "priorities", label: "Приоритеты" },
];

export default function TaskDictionaries() {
  const [params, setParams] = useSearchParams();
  const selected = params.get("tab");
  const tab = tabs.find(({ value }) => value === selected)?.value ?? "services";

  return (
    <div className={dictionaryPage}>
      <DictionaryHeading
        title="Справочники"
        description="Направления, услуги и статусы заявок"
        action={
          <Button asChild>
            <Link to={ROUTE.TASK_SERVICE_NEW}>
              <PlusIcon />
              Создать услугу
            </Link>
          </Button>
        }
      />
      <Tabs.Root
        value={tab}
        onValueChange={(value) =>
          setParams(value === "services" ? {} : { tab: value }, { replace: true })
        }
      >
        <Tabs.List aria-label="Справочники" className="mb-4 flex flex-wrap gap-2">
          {tabs.map(({ value, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        <Tabs.Content value="services" className="outline-none">
          <Services />
        </Tabs.Content>
        <Tabs.Content value="directions" className="outline-none">
          <Directions />
        </Tabs.Content>
        <Tabs.Content value="statuses" className="outline-none">
          <NamedDictionary
            label="Статус"
            addLabel="Добавить статус"
            showTerminal
            load={listTaskStatuses}
            save={(entry, values, fields) => {
              const input = { ...values, terminal: fields.has("terminal") };
              return entry
                ? taskStatuses.updateStatus({ ...input, id: entry.id }, taskCallOptions)
                : taskStatuses.createStatus(input, taskCallOptions);
            }}
          />
        </Tabs.Content>
        <Tabs.Content value="priorities" className="outline-none">
          <NamedDictionary
            label="Приоритет"
            addLabel="Добавить приоритет"
            load={listTaskPriorities}
            save={(entry, values) =>
              entry
                ? taskPriorities.updatePriority({ ...values, id: entry.id }, taskCallOptions)
                : taskPriorities.createPriority(values, taskCallOptions)
            }
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

type Row = { id: bigint; cells: ReactNode[] };

function DictionaryTable({
  headings,
  rows,
  empty,
}: {
  headings: string[];
  rows: Row[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className={`${dictionaryCard} text-sm text-muted-foreground`}>{empty}</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <Table className="tasks-dictionary-table">
        <TableHeader>
          <TableRow>
            {headings.map((heading) => (
              <TableHead key={heading} scope="col">
                {heading}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ id, cells }) => (
            <TableRow key={String(id)}>
              {cells.map((cell, index) => (
                <TableCell key={headings[index]} data-label={headings[index]}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

const rowLink =
  "inline-block text-left font-semibold wrap-anywhere hover:underline focus-visible:underline";

async function readServices(signal: AbortSignal) {
  const [services, directions] = await Promise.all([
    listTaskServices(signal),
    listTaskDirections(signal),
  ]);
  const names = new Map(directions.map(({ id, name }) => [id, name]));

  const queues = new Map<bigint, string[]>();
  for (let start = 0; start < services.length; start += 12) {
    await Promise.all(
      services.slice(start, start + 12).map(async ({ id }) => {
        const { rules } = await taskServiceRoutes.getServiceRoutes(
          { serviceId: id },
          { ...taskCallOptions, signal },
        );
        queues.set(id, [
          ...new Set(rules.filter((rule) => rule.active !== false).map((rule) => rule.queueId)),
        ]);
      }),
    );
  }

  return services.map((service) => ({
    ...service,
    direction: names.get(service.directionId) ?? "—",
    queues: queues.get(service.id)?.join(", ") || "Очередь разбора",
  }));
}

function Services() {
  return (
    <DictionaryData load={readServices}>
      {(services) => (
        <DictionaryTable
          headings={["Услуга", "Направление", "Очереди", "Состояние"]}
          empty="Услуг пока нет."
          rows={services.map((service) => ({
            id: service.id,
            cells: [
              <Link
                className={`${rowLink} task-service-link`}
                to={ROUTE.TASK_SERVICE_EDIT.replace(":serviceId", String(service.id))}
              >
                {service.name}
              </Link>,
              service.direction,
              service.queues,
              <Badge
                variant="secondary"
                className={
                  service.active
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                    : undefined
                }
              >
                {service.active ? "Активна" : "Отключена"}
              </Badge>,
            ],
          }))}
        />
      )}
    </DictionaryData>
  );
}

type NamedEntry = DictionaryValues & { id: bigint; terminal?: boolean; active?: boolean };
type NamedEditor = (
  entry: NamedEntry | undefined,
  values: DictionaryValues,
  data: FormData,
) => Promise<unknown>;

function EditDialog({
  entry,
  label,
  title,
  showTerminal,
  showDirectionActive,
  save,
  onClose,
  onSaved,
}: {
  entry?: NamedEntry;
  label: string;
  title: string;
  showTerminal?: boolean;
  showDirectionActive?: boolean;
  save: NamedEditor;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DictionaryForm onSave={(values, data) => save(entry, values, data)} onSaved={onSaved}>
          {(saving) => (
            <>
              <DictionaryFields entry={entry} label={label} />
              {showTerminal && (
                <label className="flex w-fit items-center gap-2 text-sm">
                  <input type="checkbox" name="terminal" defaultChecked={entry?.terminal} />
                  Конечный статус
                </label>
              )}
              {showDirectionActive && (
                <div className="grid gap-1">
                  <label className="flex w-fit items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={entry?.active} />
                    Направление активно
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Услуги отключённого направления скрыты из каталога.
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Отмена
                </Button>
                <SaveButton saving={saving} />
              </DialogFooter>
            </>
          )}
        </DictionaryForm>
      </DialogContent>
    </Dialog>
  );
}

async function readDirections(signal: AbortSignal) {
  const [directions, services] = await Promise.all([
    listTaskDirections(signal),
    listTaskServices(signal),
  ]);
  const counts = new Map<bigint, number>();
  for (const service of services) {
    counts.set(service.directionId, (counts.get(service.directionId) ?? 0) + 1);
  }
  return directions.map((direction) => ({ ...direction, count: counts.get(direction.id) ?? 0 }));
}

function Directions() {
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<NamedEntry>();
  const refresh = () => setVersion((previous) => previous + 1);

  return (
    <div className="grid gap-4">
      <DictionaryForm
        className={dictionaryCard}
        onSave={(values) => taskDirections.createDirection(values, taskCallOptions)}
        onSaved={refresh}
      >
        {(saving) => (
          <>
            <DictionaryFields label="Название нового направления" />
            <div>
              <SaveButton saving={saving} label="Добавить направление" />
            </div>
          </>
        )}
      </DictionaryForm>
      <DictionaryData key={version} load={readDirections}>
        {(directions) => (
          <DictionaryTable
            headings={["Направление", "Услуг", "Состояние"]}
            empty="Направлений пока нет."
            rows={directions.map((direction) => ({
              id: direction.id,
              cells: [
                <button className={rowLink} type="button" onClick={() => setEditing(direction)}>
                  {direction.name}
                </button>,
                direction.count,
                <Badge variant="secondary">
                  {direction.active ? "Активно" : "Отключено"}
                </Badge>,
              ],
            }))}
          />
        )}
      </DictionaryData>
      {editing && (
        <EditDialog
          key={String(editing.id)}
          entry={editing}
          label="Название направления"
          title="Редактировать направление"
          showDirectionActive
          save={(_, values, data) =>
            taskDirections.updateDirection(
              { ...values, id: editing.id, active: data.has("active") },
              taskCallOptions,
            )
          }
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing((current) => (current === editing ? undefined : current));
            refresh();
          }}
        />
      )}
    </div>
  );
}

function NamedDictionary({
  label,
  addLabel,
  showTerminal,
  load,
  save,
}: {
  label: string;
  addLabel: string;
  showTerminal?: boolean;
  load: (signal: AbortSignal) => Promise<NamedEntry[]>;
  save: NamedEditor;
}) {
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<{ entry?: NamedEntry }>();

  return (
    <div className="grid gap-3">
      <div>
        <Button variant="outline" onClick={() => setEditor({})}>
          <PlusIcon />
          {addLabel}
        </Button>
      </div>
      <DictionaryData key={version} load={load}>
        {(entries) => (
          <DictionaryTable
            headings={[label]}
            empty={showTerminal ? "Статусов пока нет." : "Приоритетов пока нет."}
            rows={entries.map((entry) => ({
              id: entry.id,
              cells: [
                <button className={rowLink} type="button" onClick={() => setEditor({ entry })}>
                  <Badge variant="secondary">{entry.name}</Badge>
                </button>,
              ],
            }))}
          />
        )}
      </DictionaryData>
      {editor && (
        <EditDialog
          key={editor.entry?.id.toString() ?? "new"}
          entry={editor.entry}
          label="Название"
          title={editor.entry ? `Редактировать: ${editor.entry.name}` : addLabel}
          showTerminal={showTerminal}
          save={save}
          onClose={() => setEditor(undefined)}
          onSaved={() => {
            setEditor((current) => (current === editor ? undefined : current));
            setVersion((previous) => previous + 1);
          }}
        />
      )}
    </div>
  );
}
