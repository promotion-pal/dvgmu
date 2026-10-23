import type { FC } from "react";
import { CalendarSearchIcon, FilterXIcon, PencilIcon, TrashIcon, TriangleAlertIcon } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { PromFieldInput, PromFieldSelect, PromFieldTextArea } from "@/features/lib/form";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/shared/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CommonFilterDateRange, CommonFilterSelect } from "@/shared/components/filter";
import { CommonPopover } from "@/shared/components/menu";
import { CommonModal } from "@/shared/components/modal";
import { LESSON_TONE_STYLES, ScheduleAgenda } from "@/shared/components/schedule";
import { CommonWrapperViewMode } from "@/shared/components/wrapper";
import type { useCommonWrapperViewMode } from "@/shared/components/wrapper";
import type { useComputerClass } from "./computer-class.fn";
import { COMPUTER_CLASS_KIND_LABEL, COMPUTER_CLASS_KIND_OPTIONS, ComputerClassSessionKind } from "./computer-class.schema";
import type { ComputerClassKindSlug, ComputerClassSessionFormInput } from "./computer-class.schema";
import { describeConflict, formatDayTitle, formatTime } from "./computer-class.utils";

type ComputerClass = ReturnType<typeof useComputerClass>;

/* ───────────── filters ───────────── */

const ComputerClassFilters: FC<{ state: ComputerClass }> = ({ state }) => (
    <div className="flex w-full flex-wrap items-end gap-x-5 gap-y-3">
        <CommonFilterSelect
            label="Кабинет"
            value={state.filters.room}
            onChange={(room) => state.changeFilters({ room })}
            options={state.roomOptions}
            allLabel="Все кабинеты"
            className="[&_button]:min-w-56"
        />
        <CommonFilterSelect
            label="Что проходит"
            value={state.filters.kind}
            onChange={(kind) => state.changeFilters({ kind: kind as ComputerClassKindSlug | undefined })}
            options={state.kindOptions}
            allLabel="Занятия и тестирование"
        />
        <CommonFilterDateRange
            label="Даты"
            from={state.filters.dateFrom}
            to={state.filters.dateTo}
            onChange={({ from, to }) => state.changeFilters({ dateFrom: from, dateTo: to })}
        />
        {state.hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={state.resetFilters} className="text-muted-foreground">
                <FilterXIcon className="size-4" />
                Сбросить фильтры
            </Button>
        )}
    </div>
);

/** Overlapping sessions of a room are saved as they are; this says how many
 * there are and narrows the list to them, so staff can fix each by editing. */
const ComputerClassConflictNotice: FC<{ state: ComputerClass }> = ({ state }) => {
    if (state.conflictCount === 0) return null;
    const onlyConflicts = state.filters.conflicts === "only";

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100">
            <TriangleAlertIcon className="size-4 shrink-0" />
            <span className="flex-1">
                Накладки в расписании: {state.conflictCount} {plural(state.conflictCount, "запись пересекается", "записи пересекаются", "записей пересекаются")} с
                другими в том же кабинете.{state.editable && " Исправьте время или кабинет через редактирование."}
            </span>
            <Button
                type="button"
                size="sm"
                variant="outline"
                className="bg-background"
                onClick={() => state.changeFilters({ conflicts: onlyConflicts ? undefined : "only" })}
            >
                {onlyConflicts ? "Показать все записи" : "Показать только накладки"}
            </Button>
        </div>
    );
};

const plural = (n: number, one: string, few: string, many: string) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
};

/* ───────────── board ───────────── */

const SessionsTable: FC<{ state: ComputerClass }> = ({ state }) => (
    <Card className="gap-0 overflow-hidden p-0">
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Дата</TableHead>
                        <TableHead>Время</TableHead>
                        <TableHead>Кабинет</TableHead>
                        <TableHead>Что проходит</TableHead>
                        <TableHead>Группы</TableHead>
                        {state.editable && <TableHead className="w-10" />}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {state.visible.map((session) => {
                        const conflicts = state.conflicts.get(session.id);
                        return (
                            <TableRow key={session.id} className={cn(conflicts && "bg-rose-50 hover:bg-rose-100/70 dark:bg-rose-950/30 dark:hover:bg-rose-950/50")}>
                                <TableCell className="whitespace-nowrap">{formatDayTitle(session.date)}</TableCell>
                                <TableCell className="whitespace-nowrap font-mono text-xs">{formatTime(session)}</TableCell>
                                <TableCell className="max-w-56 whitespace-normal">
                                    <span className="flex items-center gap-2">
                                        <span
                                            className={cn("size-2 shrink-0 rounded-full", LESSON_TONE_STYLES[state.tones.get(session.room) ?? "slate"].accent)}
                                            aria-hidden
                                        />
                                        {session.room}
                                    </span>
                                </TableCell>
                                <TableCell className="max-w-80 whitespace-normal font-medium">
                                    <Badge variant={session.kind === ComputerClassSessionKind.TESTING ? "default" : "secondary"} className="mb-1">
                                        {COMPUTER_CLASS_KIND_LABEL[session.kind]}
                                    </Badge>
                                    <span className="block">{session.title}</span>
                                    {session.note && <span className="block text-xs font-normal text-muted-foreground">{session.note}</span>}
                                    {conflicts && (
                                        <span className="mt-1 flex items-start gap-1 text-xs font-medium text-rose-700 dark:text-rose-300">
                                            <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                                            {describeConflict(conflicts)}
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-56 whitespace-normal text-sm">{session.groups}</TableCell>
                                {state.editable && (
                                    <TableCell>
                                        <CommonPopover
                                            items={[
                                                {
                                                    label: "Редактировать",
                                                    icon: <PencilIcon className="h-3.5 w-3.5" />,
                                                    onClick: () => state.openEdit(session),
                                                },
                                                {
                                                    label: "Удалить",
                                                    icon: <TrashIcon className="h-3.5 w-3.5" />,
                                                    style: "text-destructive hover:text-destructive",
                                                    onClick: () => state.remove(session),
                                                },
                                            ]}
                                        />
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    </Card>
);

interface ComputerClassBoardProps {
    state: ComputerClass;
    viewModeState: ReturnType<typeof useCommonWrapperViewMode>;
}

/** The timetable: day cards (shared ScheduleAgenda) or one table; clashes are marked in both. */
const ComputerClassBoard: FC<ComputerClassBoardProps> = ({ state, viewModeState }) => (
    <div className="flex flex-col gap-4">
        <ComputerClassConflictNotice state={state} />
        <ComputerClassSessions state={state} viewModeState={viewModeState} />
    </div>
);

const ComputerClassSessions: FC<ComputerClassBoardProps> = ({ state, viewModeState }) => {
    if (state.visible.length === 0) {
        return (
            <Empty className="rounded-xl border border-dashed">
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <CalendarSearchIcon />
                    </EmptyMedia>
                    <EmptyTitle>Записей нет</EmptyTitle>
                    <EmptyDescription>
                        {state.hasActiveFilters ? "По выбранным фильтрам ничего не запланировано." : "Расписание пока пустое."}
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <CommonWrapperViewMode
            {...viewModeState}
            cards={<ScheduleAgenda sections={state.agenda} />}
            tables={<SessionsTable state={state} />}
        />
    );
};

/* ───────────── form ───────────── */

/** Staff: add or edit one slot — a lesson or testing. */
const ComputerClassFormModal: FC<{ state: ComputerClass }> = ({ state }) => {
    const { form, handleSubmit, editing } = state.formState;
    const FieldInput = PromFieldInput<ComputerClassSessionFormInput>;

    return (
        <CommonModal
            open={state.modal.open}
            onOpenChange={state.modal.onOpenChange}
            title={editing ? "Редактирование записи" : "Новая запись"}
            description="Что, когда и в каком кабинете проходит. Если время пересечётся с другой записью кабинета, запись сохранится и будет отмечена как накладка."
        >
            <FormProvider {...form}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                        <FieldInput name="date" label="Дата" type="date" />
                        <FieldInput name="timeStart" label="Время с" type="time" />
                        <FieldInput name="timeEnd" label="Время по" type="time" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <PromFieldSelect<ComputerClassSessionFormInput>
                            name="kind"
                            label="Что проходит"
                            options={COMPUTER_CLASS_KIND_OPTIONS}
                            placeholder="Занятие или тестирование"
                        />
                        <FieldInput name="room" label="Кабинет" placeholder="ауд. 21" maxLength={255} />
                    </div>
                    <FieldInput name="title" label="Название" placeholder="Например: Тестирование по анатомии" maxLength={255} />
                    <FieldInput name="groups" label="Группы" placeholder="Необязательно, например: Лечебное дело, 1 курс, 101–104" maxLength={255} />
                    <PromFieldTextArea<ComputerClassSessionFormInput> name="note" label="Примечание" placeholder="Необязательно" rows={2} />

                    <Button type="submit" className="ml-auto w-fit" disabled={form.formState.isSubmitting}>
                        {editing ? "Сохранить" : "Добавить"}
                    </Button>
                </form>
            </FormProvider>
        </CommonModal>
    );
};

export { ComputerClassBoard, ComputerClassFilters, ComputerClassFormModal };
