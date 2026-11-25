import type { FC } from "react";
import { KeyRoundIcon, PrinterIcon } from "lucide-react";
import type { DeaneryActivationCode, DeaneryStudent } from "@fesmu/contract/fesmu/service/v1/deanery.service_pb";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { StudentGroup } from "./deanery.fn";

interface GroupCardProps {
    group: StudentGroup;
    selected: Set<bigint>;
    canIssue: boolean;
    busy: boolean;
    onToggle: (ids: bigint[], on: boolean) => void;
    onIssueGroup: (students: DeaneryStudent[]) => void;
}

/** Группа: студенты, выбор и «Коды группе». Выбрать можно только тех, кому можно выдать код. */
const DeaneryGroupCard: FC<GroupCardProps> = ({ group, selected, canIssue, busy, onToggle, onIssueGroup }) => {
    const issuable = group.students.filter((s) => s.canIssue);
    const ids = issuable.map((s) => s.userId);
    const picked = ids.filter((id) => selected.has(id)).length;
    const all = picked > 0 && picked === ids.length;
    return (
        <div className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
                <div className="flex items-center gap-3">
                    {canIssue && (
                        <Checkbox
                            aria-label={`Выбрать группу ${group.group}`}
                            disabled={ids.length === 0}
                            checked={all ? true : picked > 0 ? "indeterminate" : false}
                            onCheckedChange={(v) => onToggle(ids, v === true)}
                        />
                    )}
                    <div>
                        <div className="font-semibold">Группа {group.group}</div>
                        <div className="text-xs text-muted-foreground">
                            {[group.course > 0 && `${group.course} курс`, group.faculty, `студентов: ${group.students.length}`, `можно выдать: ${issuable.length}`]
                                .filter(Boolean)
                                .join(" · ")}
                        </div>
                    </div>
                </div>
                {canIssue && (
                    <Button size="sm" disabled={busy || issuable.length === 0} onClick={() => onIssueGroup(issuable)}>
                        <KeyRoundIcon className="size-4" />
                        Коды группе
                    </Button>
                )}
            </div>
            <Table>
                <TableHeader>
                    <TableRow>
                        {canIssue && <TableHead className="w-10" />}
                        <TableHead>ФИО</TableHead>
                        <TableHead>Зачётка</TableHead>
                        <TableHead>Логин</TableHead>
                        <TableHead>Статус</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {group.students.map((s) => (
                        <TableRow key={String(s.userId)} className={s.canIssue ? undefined : "text-muted-foreground"}>
                            {canIssue && (
                                <TableCell>
                                    <Checkbox
                                        aria-label={`Выбрать ${s.fullName}`}
                                        disabled={!s.canIssue}
                                        checked={selected.has(s.userId)}
                                        onCheckedChange={(v) => onToggle([s.userId], v === true)}
                                    />
                                </TableCell>
                            )}
                            <TableCell>{s.fullName}</TableCell>
                            <TableCell className="font-mono text-xs">{s.recordBook || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{s.login || "—"}</TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm">{s.status || "—"}</span>
                                    {s.issueBlocker && (
                                        <Badge variant={s.canIssue ? "secondary" : "outline"} className="w-fit text-xs">
                                            {s.canIssue ? "демо-код" : "код нельзя"}: {s.issueBlocker}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

interface ConfirmIssueDialogProps {
    students: DeaneryStudent[] | null;
    sending: boolean;
    onClose: () => void;
    onConfirm: (students: DeaneryStudent[]) => void;
}

/** Подтверждение: новый код гасит прежний — студент с паролем сможет задать его заново. */
const ConfirmIssueDialog: FC<ConfirmIssueDialogProps> = ({ students, sending, onClose, onConfirm }) => {
    const groups = [...new Set(students?.map((s) => s.group) ?? [])].sort();
    return (
        <Dialog open={students !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Выдать коды первого входа</DialogTitle>
                    <DialogDescription>
                        Студентов: {students?.length ?? 0}. {groups.length === 1 ? `Группа ${groups[0]}.` : `Группы: ${groups.join(", ")}.`}
                    </DialogDescription>
                </DialogHeader>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    <li>Прежние коды этих студентов перестанут действовать.</li>
                    <li>По коду студент задаёт новый пароль. Старый пароль после этого не работает.</li>
                    <li>Коды видны только сейчас: сразу откроется лист для печати.</li>
                </ul>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={sending}>Отмена</Button>
                    <Button disabled={sending || !students?.length} onClick={() => students && onConfirm(students)}>
                        <KeyRoundIcon className="size-4" />
                        {sending ? "Выдаём…" : "Выдать и печатать"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface IssuedDialogProps {
    codes: DeaneryActivationCode[] | null;
    onPrint: () => void;
    onClose: () => void;
}

/** Итог выдачи: сколько выдано, кому нет и почему; повторная печать. */
const IssuedDialog: FC<IssuedDialogProps> = ({ codes, onPrint, onClose }) => {
    const ok = codes?.filter((c) => c.code) ?? [];
    const failed = codes?.filter((c) => !c.code) ?? [];
    const demo = ok.filter((c) => c.demo).length;
    return (
        <Dialog open={codes !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Коды выданы: {ok.length}</DialogTitle>
                    <DialogDescription>
                        Распечатайте лист и раздайте строки студентам. После закрытия окна коды больше не показать — только выдать новые.
                        {demo > 0 && ` Демо-кодов: ${demo} — на листе они с пометкой «демо», войти по ним нельзя.`}
                    </DialogDescription>
                </DialogHeader>
                {failed.length > 0 && (
                    <div className="max-h-60 overflow-auto rounded-lg border p-3 text-sm">
                        <div className="mb-1 font-medium">Не выдано: {failed.length}</div>
                        <ul className="space-y-0.5 text-muted-foreground">
                            {failed.map((c) => (
                                <li key={String(c.userId)}>
                                    {c.fullName || `id ${c.userId}`}
                                    {c.group && ` (${c.group})`} — {c.error}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Закрыть</Button>
                    <Button disabled={ok.length === 0} onClick={onPrint}>
                        <PrinterIcon className="size-4" />
                        Печать листа
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export { ConfirmIssueDialog, DeaneryGroupCard, IssuedDialog };
