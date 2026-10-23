import { useEffect, useState } from "react";
import type { FC } from "react";
import { ClipboardCopyIcon, DownloadIcon, LoaderCircleIcon, StethoscopeIcon } from "lucide-react";
import { ConnectError, createClient } from "@connectrpc/connect";
import type { DiagnoseSection } from "@dvgmu/contract/service/v1/debtor.service_pb";
import { DebtorService } from "@dvgmu/contract/service/v1/debtor.service_pb";
import { formatDate } from "@/features/utils/date";
import { connectTransport } from "@/shared/config/api";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

/*
 * Диагностика 1С: сервер читает карту метаданных базы и проверяет таблицы
 * учёта, чтобы найти график оплаты договоров, доходы будущих периодов и ИНН.
 * Отчёт нужен разработчику для настройки расчёта актуальной задолженности,
 * поэтому его можно скопировать или скачать целиком.
 */

const debtorClient = createClient(DebtorService, connectTransport);

/** Отчёт как текст с табуляцией: заголовок раздела, колонки, строки. */
const reportText = (sections: DiagnoseSection[], finishedAt: string) =>
    [
        `Диагностика 1С, ${finishedAt}`,
        ...sections.map((section) =>
            [
                `\n=== ${section.title}`,
                section.error && `ОШИБКА: ${section.error}`,
                section.columns.join("\t"),
                ...section.rows.map((row) => row.cells.join("\t")),
            ]
                .filter(Boolean)
                .join("\n"),
        ),
    ].join("\n");

/** Сервер обрывает диагностику через 12 минут; клиент ждёт чуть дольше. */
const DIAGNOSE_TIMEOUT_MS = 13 * 60 * 1000;

const formatElapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const useDebtorDiagnose = () => {
    const [sections, setSections] = useState<DiagnoseSection[]>([]);
    const [finishedAt, setFinishedAt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [startedAt, setStartedAt] = useState(0);

    const run = async (includeMetadata: boolean) => {
        setStartedAt(Date.now());
        setLoading(true);
        setError("");
        try {
            const response = await debtorClient.debtorDiagnose({ includeMetadata }, { timeoutMs: DIAGNOSE_TIMEOUT_MS });
            setSections(response.sections);
            setFinishedAt(formatDate("datetime", response.finishedAt));
        } catch (err) {
            console.error("Ошибка диагностики 1С:", err);
            setError(ConnectError.from(err).rawMessage || "Не удалось выполнить диагностику.");
        } finally {
            setLoading(false);
        }
    };

    return { run, sections, finishedAt, loading, error, startedAt };
};

const SectionTable: FC<{ section: DiagnoseSection }> = ({ section }) => (
    <section className="flex flex-col gap-2">
        <h3 className="font-medium">{section.title}</h3>
        {section.error && <p className="text-destructive text-xs">Ошибка: {section.error}</p>}
        {section.rows.length === 0 && !section.error ? (
            <p className="text-muted-foreground text-xs">Нет данных</p>
        ) : (
            section.rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {section.columns.map((column) => (
                                    <TableHead key={column}>{column}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {section.rows.map((row, i) => (
                                <TableRow key={i}>
                                    {row.cells.map((cell, j) => (
                                        <TableCell key={j} className="align-top whitespace-normal break-words font-mono text-xs max-w-xl">
                                            {cell}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )
        )}
    </section>
);

const DebtorDiagnose: FC = () => {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [now, setNow] = useState(0);
    const [withMetadata, setWithMetadata] = useState(false);
    const { run, sections, finishedAt, loading, error, startedAt } = useDebtorDiagnose();

    // Секундомер, чтобы долгое чтение метаданных не выглядело зависанием.
    useEffect(() => {
        if (!loading) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [loading]);
    const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
    const text = sections.length > 0 ? reportText(sections, finishedAt) : "";

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Не удалось скопировать отчёт:", err);
        }
    };

    const download = () => {
        const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "diagnostika-1c.txt";
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <StethoscopeIcon />
                Диагностика 1С
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Диагностика 1С</DialogTitle>
                        <DialogDescription>
                            Проверка данных 1С, на которых построен расчёт: график оплаты договоров, счета учёта, обороты.
                            Выполняется только чтение. Чтение метаданных 1С нужно лишь для поиска новых объектов и занимает
                            до 8 минут.
                        </DialogDescription>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex flex-col gap-1 text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <LoaderCircleIcon className="size-4 animate-spin" />
                                Формирование отчёта… <span className="tabular-nums">{formatElapsed(elapsed)}</span>
                            </div>
                            <p className="text-xs">
                                Проверки таблиц учёта занимают до 2 минут каждая{withMetadata && ", чтение метаданных — до 8 минут"}. Если
                                проверка не уложится во время, отчёт придёт с отметкой об этом.
                            </p>
                        </div>
                    ) : error ? (
                        <p className="text-destructive">{error}</p>
                    ) : sections.length > 0 ? (
                        <div className="flex flex-col gap-6">
                            <p className="text-xs text-muted-foreground">Отчёт сформирован: {finishedAt}</p>
                            {sections.map((section) => (
                                <SectionTable key={section.title} section={section} />
                            ))}
                        </div>
                    ) : null}

                    <DialogFooter>
                        {sections.length > 0 && !loading && (
                            <>
                                <Button variant="outline" onClick={copy}>
                                    <ClipboardCopyIcon />
                                    {copied ? "Скопировано" : "Скопировать отчёт"}
                                </Button>
                                <Button variant="outline" onClick={download}>
                                    <DownloadIcon />
                                    Скачать .txt
                                </Button>
                            </>
                        )}
                        <label className="mr-auto flex items-center gap-2 text-sm cursor-pointer select-none">
                            <Checkbox checked={withMetadata} onCheckedChange={(v) => setWithMetadata(v === true)} disabled={loading} />
                            Читать метаданные 1С (до 8 минут)
                        </label>
                        <Button onClick={() => run(withMetadata)} disabled={loading}>
                            {sections.length > 0 ? "Повторить" : "Запустить"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

export { DebtorDiagnose };
