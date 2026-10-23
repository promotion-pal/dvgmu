import { useState } from "react";
import type { ComponentProps, FC } from "react";
import { Building2Icon, ChevronDownIcon, CopyIcon, KeyRoundIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { AccessGroup, User } from "@dvgmu/contract/mdm/entity/user.entity_pb";
import type { UserEmployeeDepartment, UserRole } from "@dvgmu/contract/mdm/enum/user.enum_pb";
import { CommonControlState } from "@/shared/components/state/control-state";
import { DepartmentFilter, DepartmentMultiPicker } from "@/shared/components/department";
import type { DepartmentFilterValue } from "@/shared/components/department";
import { DEPARTMENT_LABEL } from "@/shared/config/departments";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ROLES, ROLE_LABEL, formatUserFullName, isEmployee } from "./role-admin.fn";
import type { BulkAction } from "./role-admin.fn";

/** Выпадашка с отметками: роли или права одного пользователя. */
interface PickerProps<T extends string | number> {
    options: readonly { value: T; label: string; hint?: string }[];
    value: T[];
    disabled: boolean;
    empty: string;
    title: string;
    onToggle: (value: T, on: boolean) => void;
}
const Picker = <T extends string | number>({ options, value, disabled, empty, title, onToggle }: PickerProps<T>) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={disabled} className="h-auto min-h-8 max-w-64 flex-wrap justify-start gap-1 px-2 py-1">
                {value.length === 0 && <span className="text-muted-foreground">{empty}</span>}
                {options
                    .filter((o) => value.includes(o.value))
                    .map((o) => (
                        <Badge key={o.value} variant="secondary">{o.label}</Badge>
                    ))}
                <ChevronDownIcon className="size-3.5 opacity-50" />
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {options.map((o) => (
                <DropdownMenuCheckboxItem
                    key={o.value}
                    checked={value.includes(o.value)}
                    // Меню не закрывается: можно отметить несколько подряд.
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) => onToggle(o.value, checked === true)}
                >
                    <span className="flex flex-col">
                        <span>{o.label}</span>
                        {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                    </span>
                </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
    </DropdownMenu>
);

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABEL[role] }));

interface RoleUserTableProps extends ComponentProps<typeof CommonControlState> {
    list: User[];
    groups: AccessGroup[];
    saving: Set<bigint>;
    locked: boolean;
    selected: Set<bigint>;
    onCheck: (ids: bigint[], on: boolean) => void;
    onToggleRole: (user: User, role: UserRole, on: boolean) => void;
    onToggleGroup: (user: User, id: bigint, on: boolean) => void;
    onSetDepartments: (user: User, departments: UserEmployeeDepartment[]) => void;
    onSetPosition: (user: User, position: string) => void;
    onIssueCode: (user: User) => void;
}

/** Должность: сохраняется, когда поле теряет фокус или по Enter. */
const PositionInput: FC<{ user: User; disabled: boolean; onSave: (position: string) => void }> = ({ user, disabled, onSave }) => {
    const [value, setValue] = useState(user.position);
    return (
        <input
            className="w-full min-w-40 rounded-md border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground disabled:opacity-60"
            placeholder="Должность"
            aria-label={`Должность: ${formatUserFullName(user)}`}
            maxLength={255}
            disabled={disabled}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => onSave(value)}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        />
    );
};
const RoleUserTable: FC<RoleUserTableProps> = ({
    list,
    groups,
    saving,
    locked,
    selected,
    onCheck,
    onToggleRole,
    onToggleGroup,
    onSetDepartments,
    onSetPosition,
    onIssueCode,
    ...state
}) => {
    // id набора строкой: Picker работает со строками/числами.
    const groupOptions = groups.map((g) => ({ value: g.id.toString(), label: g.name, hint: g.description || undefined }));

    const pageIds = list.map((user) => user.id);
    const checkedOnPage = pageIds.filter((id) => selected.has(id)).length;
    const pageState = checkedOnPage === 0 ? false : checkedOnPage === pageIds.length ? true : "indeterminate";

    return (
        <CommonControlState {...state}>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">
                            <Checkbox
                                aria-label="Отметить всех на странице"
                                checked={pageState}
                                disabled={locked}
                                onCheckedChange={(checked) => onCheck(pageIds, checked === true)}
                            />
                        </TableHead>
                        <TableHead>ФИО</TableHead>
                        <TableHead>Логин</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Подразделения и должность</TableHead>
                        <TableHead>Роли</TableHead>
                        <TableHead>Доступы</TableHead>
                        <TableHead className="text-center">Активация</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {list.map((user) => {
                        const busy = locked || saving.has(user.id);
                        return (
                            <TableRow key={user.id.toString()} data-state={selected.has(user.id) ? "selected" : undefined}>
                                <TableCell>
                                    <Checkbox
                                        aria-label={`Отметить: ${formatUserFullName(user)}`}
                                        checked={selected.has(user.id)}
                                        disabled={locked}
                                        onCheckedChange={(checked) => onCheck([user.id], checked === true)}
                                    />
                                </TableCell>
                                <TableCell>{formatUserFullName(user)}</TableCell>
                                <TableCell className="font-mono text-xs">{user.username || "—"}</TableCell>
                                <TableCell>{user.email || "—"}</TableCell>
                                <TableCell>
                                    {isEmployee(user) ? (
                                        <div className="flex flex-col gap-1">
                                            <DepartmentMultiPicker
                                                value={user.departments}
                                                disabled={busy}
                                                onChange={(departments) => onSetDepartments(user, departments)}
                                            />
                                            {/* key: a saved or reverted value starts the field over */}
                                            <PositionInput key={user.position} user={user} disabled={busy} onSave={(position) => onSetPosition(user, position)} />
                                        </div>
                                    ) : (
                                        <span className="px-2 text-muted-foreground" title="Только для сотрудников: сначала роль «Сотрудник»">
                                            —
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Picker
                                        title="Роли — открывают разделы"
                                        empty="Без роли"
                                        options={ROLE_OPTIONS}
                                        value={user.roles}
                                        disabled={busy}
                                        onToggle={(role, on) => onToggleRole(user, role, on)}
                                    />
                                </TableCell>
                                <TableCell>
                                    <Picker
                                        title={groups.length > 0 ? "Доступы — какие разделы открыты" : "Доступов нет — создайте в «Доступы»"}
                                        empty="—"
                                        options={groupOptions}
                                        value={user.accessGroupIds.map(String)}
                                        disabled={busy}
                                        onToggle={(id, on) => onToggleGroup(user, BigInt(id), on)}
                                    />
                                    {/* Доступы подразделений — сами, снять их можно только в «Доступы» или сменив подразделение */}
                                    {user.departmentAccessGroupIds.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1 px-2">
                                            {groups
                                                .filter((g) => user.departmentAccessGroupIds.includes(g.id))
                                                .map((g) => (
                                                    <Badge key={g.id.toString()} variant="outline" title="Через подразделение">
                                                        <Building2Icon className="size-3" />
                                                        {g.name}
                                                    </Badge>
                                                ))}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={!user.username}
                                        title={user.username ? "Выдать код активации" : "Нет логина AD — код выдать нельзя"}
                                        onClick={() => onIssueCode(user)}
                                    >
                                        <KeyRoundIcon className="size-4" />
                                        Код
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </CommonControlState>
    );
};

const ADD = "add";
const REMOVE = "remove";

const DEPARTMENT_TARGET = "department";

interface BulkBarProps {
    groups: AccessGroup[];
    selectedCount: number;
    foundCount: number;
    allFoundSelected: boolean;
    progress: { done: number; total: number } | null;
    onSelectFound: () => void;
    onClear: () => void;
    onApply: (action: BulkAction) => Promise<void>;
}
/** Панель массовых действий над отмеченными: что сделать × какую роль/право. */
const BulkBar: FC<BulkBarProps> = ({ groups, selectedCount, foundCount, allFoundSelected, progress, onSelectFound, onClear, onApply }) => {
    const [mode, setMode] = useState<string>(ADD);
    // "role:4" или "perm:certificate.view"
    const [target, setTarget] = useState<string>("");
    const [confirming, setConfirming] = useState(false);
    // Подразделение для массового действия (target = DEPARTMENT_TARGET).
    const [department, setDepartment] = useState<DepartmentFilterValue>("all");

    const action: BulkAction | null = target.startsWith("role:")
        ? { kind: "role", on: mode === ADD, role: Number(target.slice(5)) as UserRole }
        : target.startsWith("group:")
          ? { kind: "group", on: mode === ADD, id: BigInt(target.slice(6)) }
          : target === DEPARTMENT_TARGET && typeof department === "number"
            ? { kind: "department", on: mode === ADD, department }
            : null;
    const targetLabel = target.startsWith("role:")
        ? `роль «${ROLE_LABEL[Number(target.slice(5)) as (typeof ROLES)[number]]}»`
        : target === DEPARTMENT_TARGET
          ? `подразделение «${typeof department === "number" ? DEPARTMENT_LABEL[department] : ""}»`
          : `доступ «${groups.find((g) => `group:${g.id}` === target)?.name ?? ""}»`;

    if (selectedCount === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2">
            <span className="text-sm font-medium">Отмечено: {selectedCount}</span>
            {!allFoundSelected && (
                <Button variant="link" size="sm" className="px-1" disabled={progress !== null} onClick={onSelectFound}>
                    Отметить всех найденных ({foundCount})
                </Button>
            )}
            <Select value={mode} onValueChange={setMode} disabled={progress !== null}>
                <SelectTrigger className="w-auto min-w-32">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value={ADD}>Добавить</SelectItem>
                    <SelectItem value={REMOVE}>Убрать</SelectItem>
                </SelectContent>
            </Select>
            <Select value={target} onValueChange={setTarget} disabled={progress !== null}>
                <SelectTrigger className="w-auto min-w-56">
                    <SelectValue placeholder="Роль, доступ или подразделение…" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>Роли</SelectLabel>
                        {ROLES.map((role) => (
                            <SelectItem key={role} value={`role:${role}`}>{ROLE_LABEL[role]}</SelectItem>
                        ))}
                    </SelectGroup>
                    <SelectGroup>
                        <SelectLabel>Сотрудник</SelectLabel>
                        <SelectItem value={DEPARTMENT_TARGET}>Подразделение…</SelectItem>
                    </SelectGroup>
                    {groups.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Доступы</SelectLabel>
                            {groups.map((g) => (
                                <SelectItem key={g.id.toString()} value={`group:${g.id}`}>{g.name}</SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                </SelectContent>
            </Select>
            {target === DEPARTMENT_TARGET && <DepartmentFilter withAll={false} value={department} onChange={setDepartment} />}
            <Button size="sm" disabled={!action || progress !== null} onClick={() => setConfirming(true)}>
                {progress ? `Сохранение ${progress.done}/${progress.total}…` : "Применить"}
            </Button>
            <Button variant="ghost" size="sm" disabled={progress !== null} onClick={onClear}>
                <XIcon className="size-4" />
                Снять отметки
            </Button>

            <Dialog open={confirming} onOpenChange={setConfirming}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{mode === ADD ? "Добавить" : "Убрать"} {targetLabel}?</DialogTitle>
                        <DialogDescription>
                            Отмечено пользователей: {selectedCount}. У кого уже так — не изменится.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirming(false)}>Отмена</Button>
                        <Button
                            variant={mode === ADD ? "default" : "destructive"}
                            onClick={async () => {
                                setConfirming(false);
                                if (action) await onApply(action);
                            }}
                        >
                            {mode === ADD ? "Добавить" : "Убрать"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

interface IssuedCodeDialogProps {
    issued: { user: User; code: string; expiresAt: Date } | null;
    onClose: () => void;
}
const IssuedCodeDialog: FC<IssuedCodeDialogProps> = ({ issued, onClose }) => {
    const copy = async () => {
        if (!issued) return;
        try {
            await navigator.clipboard.writeText(issued.code);
            toast.success("Код скопирован");
        } catch {
            toast.error("Не удалось скопировать — перепишите код вручную");
        }
    };

    return (
        <Dialog open={issued !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Код активации</DialogTitle>
                    <DialogDescription>
                        {issued && `${formatUserFullName(issued.user)}, логин ${issued.user.username}`}
                    </DialogDescription>
                </DialogHeader>
                {issued && (
                    <div className="flex flex-col items-center gap-3 py-2">
                        <span className="font-mono text-3xl tracking-widest">{issued.code}</span>
                        <p className="text-center text-sm text-muted-foreground">
                            Действует до {issued.expiresAt.toLocaleDateString("ru-RU")}. Показывается один раз — прежний код
                            больше не работает. Вход: auth.fesmu.ru → «Первый вход по коду активации».
                        </p>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="outline" onClick={copy}>
                        <CopyIcon className="size-4" />
                        Скопировать
                    </Button>
                    <Button onClick={onClose}>Готово</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export { BulkBar, IssuedCodeDialog, RoleUserTable };
