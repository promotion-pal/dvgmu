import { useMemo, useState } from "react";
import type { ComponentProps, FC } from "react";
import { CheckIcon, PrinterIcon, XIcon } from "lucide-react";
import { CertificateOrderStatus } from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import type { CertificateOrderEntry } from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import type { FileGenerateType } from "@fesmu/contract/file/enum/file.enum_pb";
import type { User } from "@fesmu/contract/mdm/entity/user.entity_pb";
import { formatDate } from "@/features/utils/date";
import { CommonControlState } from "@/shared/components/state/control-state";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CERTIFICATE_STATUS } from "@/features/certificate/certificate.fn";
import { Textarea } from "@/shared/ui/textarea";
import { CERTIFICATE_TYPES, typeLabel } from "./certificate-journal.fn";

interface CertificateJournalTableProps extends ComponentProps<typeof CommonControlState> {
    list: CertificateOrderEntry[];
    canIssue: boolean;
    busy: bigint | null;
    onPrint: (order: CertificateOrderEntry) => void;
    onIssue: (order: CertificateOrderEntry) => void;
    onCancel: (order: CertificateOrderEntry) => void;
}

/** Кто и когда сдвинул заказ по пути «заказана → готова → выдана». */
const progress = (o: CertificateOrderEntry) => {
    if (o.status === CertificateOrderStatus.ISSUED) return `${o.issuedBy}, ${formatDate("datetime", o.issuedAt)}`;
    if (o.status === CertificateOrderStatus.READY) return `напечатал ${o.preparedBy}, ${formatDate("datetime", o.readyAt)}`;
    if (o.status === CertificateOrderStatus.CANCELLED) return `${o.preparedBy}: ${o.cancelReason}`;
    return `заказал ${o.orderedBy}`;
};

const CertificateJournalTable: FC<CertificateJournalTableProps> = ({ list, canIssue, busy, onPrint, onIssue, onCancel, ...state }) => (
    <CommonControlState {...state}>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Заказана</TableHead>
                    <TableHead>Студент</TableHead>
                    <TableHead>Факультет</TableHead>
                    <TableHead>Справка</TableHead>
                    <TableHead className="text-center">Экз.</TableHead>
                    <TableHead>Статус</TableHead>
                    {canIssue && <TableHead />}
                </TableRow>
            </TableHeader>
            <TableBody>
                {list.map((order) => {
                    const st = CERTIFICATE_STATUS[order.status];
                    const ordered = order.status === CertificateOrderStatus.ORDERED;
                    const ready = order.status === CertificateOrderStatus.READY;
                    const cancelled = order.status === CertificateOrderStatus.CANCELLED;
                    const disabled = busy === order.id;
                    return (
                        <TableRow key={order.id.toString()}>
                            <TableCell className="whitespace-nowrap">{formatDate("datetime", order.createdAt)}</TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <span>{order.studentName}</span>
                                    {(order.group || order.recordBook) && (
                                        <span className="text-xs text-muted-foreground">
                                            {[order.group && `гр. ${order.group}`, order.recordBook && `зач. ${order.recordBook}`].filter(Boolean).join(" · ")}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {order.faculty || <span className="text-muted-foreground">не определён</span>}
                            </TableCell>
                            <TableCell>{typeLabel(order.type)}</TableCell>
                            <TableCell className="text-center">{order.copies}</TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <Badge variant={st.tone} className="w-fit">{st.label}</Badge>
                                    <span className="max-w-64 text-xs text-muted-foreground">{progress(order)}</span>
                                </div>
                            </TableCell>
                            {canIssue && (
                                <TableCell>
                                    <div className="flex flex-wrap justify-end gap-1.5">
                                        {!cancelled && (
                                            <Button size="sm" variant={ordered ? "default" : "outline"} disabled={disabled} onClick={() => onPrint(order)}>
                                                <PrinterIcon className="size-4" />
                                                {ordered ? "Печать" : "Перепечатать"}
                                            </Button>
                                        )}
                                        {ready && (
                                            <Button size="sm" disabled={disabled} onClick={() => onIssue(order)}>
                                                <CheckIcon className="size-4" />
                                                Выдана
                                            </Button>
                                        )}
                                        {(ordered || ready) && (
                                            <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onCancel(order)}>
                                                <XIcon className="size-4" />
                                                Отклонить
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    </CommonControlState>
);

interface CancelDialogProps {
    order: CertificateOrderEntry | null;
    onClose: () => void;
    onSubmit: (order: CertificateOrderEntry, reason: string) => Promise<void>;
}
/** Отклонение заказа: причину увидит студент в кабинете. */
const CancelDialog: FC<CancelDialogProps> = ({ order, onClose, onSubmit }) => {
    const [reason, setReason] = useState("");
    const [sending, setSending] = useState(false);
    const close = () => {
        setReason("");
        onClose();
    };
    const submit = async () => {
        if (!order || !reason.trim()) return;
        setSending(true);
        await onSubmit(order, reason.trim());
        setSending(false);
        close();
    };
    return (
        <Dialog open={order !== null} onOpenChange={(next) => !next && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Отклонить заказ</DialogTitle>
                    <DialogDescription>
                        {order?.studentName}. Причину студент увидит в кабинете — напишите, что ему сделать.
                    </DialogDescription>
                </DialogHeader>
                <Textarea
                    autoFocus
                    rows={3}
                    maxLength={500}
                    placeholder="Например: нет приказа о зачислении — обратитесь в деканат"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                />
                <DialogFooter>
                    <Button variant="outline" onClick={close}>Отмена</Button>
                    <Button variant="destructive" disabled={!reason.trim() || sending} onClick={submit}>Отклонить</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const fullName = (u: User) => `${u.lastName} ${u.firstName} ${u.patronymic ?? ""}`.trim();

interface OrderForDialogProps {
    open: boolean;
    users: User[];
    loading: boolean;
    onClose: () => void;
    onSubmit: (student: User, type: FileGenerateType, copies: number) => Promise<boolean>;
}
const OrderForDialog: FC<OrderForDialogProps> = ({ open, users, loading, onClose, onSubmit }) => {
    const [query, setQuery] = useState("");
    const [student, setStudent] = useState<User | null>(null);
    const [type, setType] = useState<FileGenerateType>(CERTIFICATE_TYPES[0].type);
    const [copies, setCopies] = useState(1);
    const [sending, setSending] = useState(false);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        return users.filter((u) => fullName(u).toLowerCase().includes(q) || (u.username ?? "").includes(q)).slice(0, 20);
    }, [users, query]);

    const close = () => {
        setQuery("");
        setStudent(null);
        setCopies(1);
        onClose();
    };

    const submit = async () => {
        if (!student) return;
        setSending(true);
        const ok = await onSubmit(student, type, copies);
        setSending(false);
        if (ok) close();
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && close()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Сформировать справку за студента</DialogTitle>
                    <DialogDescription>Справка сразу записывается в журнал как выданная вами.</DialogDescription>
                </DialogHeader>

                {student ? (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span>{fullName(student)}</span>
                        <Button variant="ghost" size="sm" onClick={() => setStudent(null)}>Другой</Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        <Input
                            autoFocus
                            placeholder={loading ? "Загрузка списка…" : "ФИО или логин (от 2 букв)"}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <div className="max-h-60 overflow-y-auto">
                            {matches.map((u) => (
                                <button
                                    key={u.id.toString()}
                                    type="button"
                                    className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                                    onClick={() => setStudent(u)}
                                >
                                    {fullName(u)} <span className="text-muted-foreground">{u.username}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-2">
                    <Select value={String(type)} onValueChange={(v) => setType(Number(v) as FileGenerateType)}>
                        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {CERTIFICATE_TYPES.map((t) => (
                                <SelectItem key={t.type} value={String(t.type)}>{t.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Input
                        className="w-24"
                        type="number"
                        min={1}
                        max={10}
                        value={copies}
                        onChange={(e) => setCopies(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={close}>Отмена</Button>
                    <Button disabled={!student || sending} onClick={submit}>
                        <PrinterIcon className="size-4" />
                        Сформировать
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export { CancelDialog, CertificateJournalTable, OrderForDialog };
