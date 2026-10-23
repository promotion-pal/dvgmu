"use client";

import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import {
  CalendarClock,
  CalendarPlus,
  ChevronDown,
  Compass,
  Download,
  HelpCircle,
  Search,
  UserPlus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ENV } from "@/shared/config/env";
import { cn } from "@/shared/lib/utils";
import { toISODateUTC } from "@/shared/lib/duty-window";
import { CommonControlState } from "@/shared/components/state";
import { CommonTable } from "@/shared/components/table";
import { Badge } from "@/shared/ui/badge";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/collapsible";
import { Input } from "@/shared/ui/input";

import {
  AdminDateDialog,
  AdminNewRegistrationDialog,
  type AdminDateMode,
} from "./dormitory.admin";
import { DutyRow, useDutyRegistrationForm, useDutyRegistrations } from "./dormitory.fn";
import { DutyRegistrationForm } from "./dormitory.form";

const formatDate = (value?: Timestamp) =>
  value ? timestampDate(value).toLocaleDateString("ru-RU") : "—";

const DutyRegistrationBlock = () => {
  const [done, setDone] = useState(false);
  const formState = useDutyRegistrationForm(() => setDone(true));

  if (done) {
    return (
      <Card className="w-full gap-4 p-6">
        <p className="font-medium text-accent-dark">
          Вы записаны на дежурство. Спасибо!
        </p>
      </Card>
    );
  }

  return <DutyRegistrationForm {...formState} />;
};

const dutyColumns = [
  { key: "fullName", header: "Студент" },
  { key: "faculty", header: "Факультет" },
  {
    key: "group",
    header: "Группа",
    render: (row: DutyRow) => row.group || "—",
  },
  {
    key: "course",
    header: "Курс",
    render: (row: DutyRow) => (row.course ? `${row.course}` : "—"),
  },
  { key: "recordBook", header: "Зачётка" },
  { key: "room", header: "Комната" },
  { key: "phone", header: "Телефон" },
  {
    key: "data",
    header: "Дата дежурства",
    render: (row: DutyRow) => formatDate(row.data),
  },
] as const;

const rowIso = (row: DutyRow): string | null =>
  row.data ? toISODateUTC(timestampDate(row.data)) : null;

/** Легенда иконок и функций админ-панели — показывается в блоке «Как пользоваться». */
const legendItems = [
  {
    icon: UserPlus,
    label: "Записать студента",
    description:
      "Открывает форму и сразу создаёт запись — без ограничений, которые действуют для обычной студенческой формы (курс, дата, время не проверяются).",
  },
  {
    icon: Search,
    label: "Поиск по ФИО",
    description:
      "Фильтрует список ниже по фамилии/имени — сразу по всем этажам выбранного месяца.",
  },
  {
    icon: Compass,
    label: "Быстрый переход",
    description:
      "Кнопки с номером этажа и количеством записей — клик прокручивает страницу к нужной карточке этажа.",
  },
  {
    icon: CalendarClock,
    label: "«Дата» у студента в таблице",
    description:
      "Переносит дежурство этого студента на другой день — открывает календарь для выбора новой даты.",
  },
  {
    icon: CalendarPlus,
    label: "«+ день» у студента в таблице",
    description:
      "Добавляет студенту ещё один день дежурства в этом же месяце, не трогая уже существующую запись.",
  },
  {
    icon: Download,
    label: "Скачать график .docx",
    description:
      "Скачивает готовый Word-документ с графиком дежурств по этому этажу за выбранный месяц.",
  },
] as const;

const AdminLegend = () => {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-fit">
          <HelpCircle />
          Что означают кнопки
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <Card className="mt-2 gap-3 p-4">
          {legendItems.map(({ icon: Icon, label, description }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-3">
            <Badge variant="secondary" className="mt-0.5 shrink-0">
              12
            </Badge>
            <div>
              <p className="text-sm font-medium">Цифра-бейдж</p>
              <p className="text-sm text-muted-foreground">
                Количество записанных на этот этаж в выбранном месяце (или в
                результатах поиска).
              </p>
            </div>
          </div>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
};

/** Ключ месяца «YYYY-MM» (UTC — как хранится дата дежурства). */
const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

/** Месяцы для выбора графика: прошлый, текущий, следующий, +2. */
const rosterMonthOptions = (
  now: Date = new Date(),
): { value: string; label: string }[] =>
  [-1, 0, 1, 2].map((offset) => {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1));
    return {
      value: monthKey(d),
      label: d.toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    };
  });

const DutyRegistrationsByFloor = () => {
  const { rows, loading, error, fetch } = useDutyRegistrations();
  const [editing, setEditing] = useState<{
    row: DutyRow;
    mode: AdminDateMode;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const monthOptions = useMemo(() => rosterMonthOptions(), []);
  // по умолчанию — текущий месяц (его график сейчас и нужен);
  // на следующий (идёт запись) и соседние можно переключиться
  const [month, setMonth] = useState(() => monthOptions[1].value);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  // записи выбранного месяца — именно они попадают в .docx
  const monthRows = useMemo(
    () => rows.filter((row) => rowIso(row)?.startsWith(month)),
    [rows, month],
  );

  // поиск по ФИО — не зависит от месяца, ищет по всем загруженным записям месяца
  const searchedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return monthRows;
    return monthRows.filter((row) => row.fullName.toLowerCase().includes(query));
  }, [monthRows, search]);

  const empty = !loading && !error && searchedRows.length === 0;

  const groups = useMemo(() => {
    const map = new Map<string, DutyRow[]>();
    for (const row of searchedRows) {
      const key = row.floor === null ? "—" : String(row.floor);
      const bucket = map.get(key);
      if (bucket) bucket.push(row);
      else map.set(key, [row]);
    }
    return [...map.entries()].sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }, [searchedRows]);

  const scrollToFloor = (floor: string) => {
    document
      .getElementById(`floor-${floor}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // занятые даты (ISO) по этажам — для календаря админа
  const takenByFloor = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const row of rows) {
      const iso = rowIso(row);
      if (row.floor === null || !iso) continue;
      if (!map.has(row.floor)) map.set(row.floor, new Set());
      map.get(row.floor)!.add(iso);
    }
    return map;
  }, [rows]);

  const takenIsoFor = (row: DutyRow, mode: AdminDateMode): string[] => {
    if (row.floor === null) return [];
    const set = new Set(takenByFloor.get(row.floor) ?? []);
    if (mode === "move") {
      const own = rowIso(row);
      if (own) set.delete(own);
    }
    return [...set];
  };

  const actionColumn = {
    key: "actions",
    header: "",
    className: "text-right whitespace-nowrap",
    render: (row: DutyRow) => (
      <span className="inline-flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setEditing({ row, mode: "move" })}
        >
          <CalendarClock />
          Дата
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setEditing({ row, mode: "add" })}
        >
          <CalendarPlus />+ день
        </Button>
      </span>
    ),
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminLegend />

      <div className="flex flex-wrap items-end gap-4">
        <Button
          type="button"
          className="w-fit"
          onClick={() => setCreating(true)}
        >
          <UserPlus />
          Записать студента
        </Button>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Месяц графика</span>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-input bg-card px-3 py-2 text-sm capitalize outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value} className="capitalize">
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Поиск по ФИО</span>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Иванов Иван"
              className="pl-8"
            />
          </div>
        </label>
      </div>

      {groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <Compass className="size-4" />
            Быстрый переход:
          </span>
          {groups.map(([floor, list]) => (
            <Button
              key={floor}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => scrollToFloor(floor)}
            >
              {floor === "—" ? "—" : floor} этаж
              <Badge variant="secondary" className="ml-1">
                {list.length}
              </Badge>
            </Button>
          ))}
        </div>
      )}

      <CommonControlState isError={error} isEmpty={empty} isLoading={loading}>
        <div className="flex flex-col gap-6">
          {groups.map(([floor, list]) => (
            <Card key={floor} id={`floor-${floor}`} className="scroll-mt-4 gap-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="h3">
                  {floor === "—" ? "Этаж не определён" : `${floor} этаж`}
                </h3>
                <Badge variant="secondary">{list.length}</Badge>
                {floor !== "—" && (
                  <a
                    href={`${ENV.API}/admin/duty-roster.docx?floor=${floor}&month=${month}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "ml-auto",
                    )}
                  >
                    <Download />
                    Скачать график .docx
                  </a>
                )}
              </div>
              <CommonTable<DutyRow>
                data={list}
                columns={[...dutyColumns, actionColumn]}
              />
            </Card>
          ))}
        </div>
      </CommonControlState>

      {editing && (
        <AdminDateDialog
          row={editing.row}
          mode={editing.mode}
          takenIso={takenIsoFor(editing.row, editing.mode)}
          onClose={() => setEditing(null)}
          onDone={() => void fetch()}
        />
      )}

      {creating && (
        <AdminNewRegistrationDialog
          takenByFloor={takenByFloor}
          onClose={() => setCreating(false)}
          onDone={() => void fetch()}
        />
      )}
    </div>
  );
};

export { DutyRegistrationBlock, DutyRegistrationsByFloor };
