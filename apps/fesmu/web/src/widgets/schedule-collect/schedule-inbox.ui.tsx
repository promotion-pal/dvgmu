import { useEffect, useState } from "react";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { scheduleCollectApi } from "./schedule-collect.api";

const sentDate = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Vladivostok",
});

type Result = Awaited<ReturnType<typeof scheduleCollectApi.fetch>>;

export function ScheduleInbox() {
    const [offset, setOffset] = useState(0);
    const [previousOffsets, setPreviousOffsets] = useState<number[]>([]);
    const [request, setRequest] = useState(0);
    const [response, setResponse] = useState<Result | "error">();

    useEffect(() => {
        const controller = new AbortController();
        scheduleCollectApi.fetch(offset, controller.signal).then(
            (result) => { if (!controller.signal.aborted) setResponse(result); },
            () => { if (!controller.signal.aborted) setResponse("error"); },
        );
        return () => controller.abort();
    }, [offset, request]);

    const page = response === "error" ? undefined : response;
    const reload = () => {
        setResponse(undefined);
        setRequest((current) => current + 1);
    };

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Записи преподавателей для подготовки расписания.</p>
            <CommonControlState
                isLoading={response === undefined}
                isError={response === "error"}
                isEmpty={page?.items.length === 0}
                empty={<p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">Сведения пока не поступили.</p>}
                error={<CommonServiceError service="Сбор расписания" onRetry={reload} />}
            >
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Отправлено</TableHead>
                            <TableHead>Дата занятия</TableHead>
                            <TableHead>Группа</TableHead>
                            <TableHead>Пара / аудитория</TableHead>
                            <TableHead>Дисциплина</TableHead>
                            <TableHead>Преподаватель</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {page?.items.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell>{entry.createdAt ? sentDate.format(new Date(entry.createdAt)) : "—"}</TableCell>
                                <TableCell>{entry.date}</TableCell>
                                <TableCell>{entry.group || "—"}</TableCell>
                                <TableCell>{entry.les} / {entry.aud}</TableCell>
                                <TableCell className="whitespace-normal">
                                    {entry.subject} · {entry.subjType}
                                    {entry.themas && <p className="text-muted-foreground">{entry.themas}</p>}
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    {entry.name}
                                    {entry.substitutionName && (
                                        <p className="text-muted-foreground">
                                            Замена · {[entry.substitutionName, entry.substitutionSubject, entry.substitutionSubjType, entry.substitutionThemas].filter(Boolean).join(" · ")}
                                        </p>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CommonControlState>
            <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={previousOffsets.length === 0 || !response} onClick={() => {
                    setResponse(undefined);
                    setOffset(previousOffsets[previousOffsets.length - 1]);
                    setPreviousOffsets(previousOffsets.slice(0, -1));
                }}>Предыдущая страница</Button>
                <Button type="button" variant="outline" disabled={!page?.hasMore} onClick={() => {
                    if (!page) return;
                    setResponse(undefined);
                    setPreviousOffsets([...previousOffsets, offset]);
                    setOffset(offset + page.items.length);
                }}>Следующая страница</Button>
                <Button type="button" variant="ghost" disabled={!response} onClick={reload}>Обновить</Button>
            </div>
        </div>
    );
}
