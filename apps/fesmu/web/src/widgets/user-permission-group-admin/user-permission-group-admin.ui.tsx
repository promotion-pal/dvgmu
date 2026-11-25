import { useState } from "react";
import type { ComponentProps, FC } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import type { UserPermissionGroup } from "@fesmu/contract/mdm/entity/user.entity_pb";
import {
    ACTION_LABEL,
    PURCHASE_PERMISSIONS,
    PURCHASE_PERMISSION_GROUPS,
    PermissionAction,
    SECTIONS,
    SECTION_GROUPS,
    perm,
    purchasePerm,
    summarizePermissions,
} from "@/shared/config/permissions";
import { CommonControlState } from "@/shared/components/state/control-state";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { toggleHallManagement, toggleSectionAction, toggleSections } from "./user-permission-group-admin.fn";
import type { UserPermissionGroupDraft } from "./user-permission-group-admin.fn";

interface UserPermissionGroupListProps extends ComponentProps<typeof CommonControlState> {
    list: UserPermissionGroup[];
    onEdit: (group: UserPermissionGroup) => void;
    onDelete: (group: UserPermissionGroup) => void;
}
const UserPermissionGroupList: FC<UserPermissionGroupListProps> = ({ list, onEdit, onDelete, ...state }) => (
    <CommonControlState {...state}>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((group) => (
                <article key={group.id.toString()} className="flex flex-col gap-3 rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-col gap-1">
                            <h3 className="font-medium">{group.name}</h3>
                            {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
                        </div>
                        <div className="flex shrink-0 gap-1">
                            <Button variant="ghost" size="icon" aria-label={`Изменить «${group.name}»`} onClick={() => onEdit(group)}>
                                <PencilIcon className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`Удалить «${group.name}»`} onClick={() => onDelete(group)}>
                                <Trash2Icon className="size-4" />
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {group.permissions.length === 0 && <span className="text-sm text-muted-foreground">Разделов нет</span>}
                        {summarizePermissions(group.permissions).map((label) => (
                            <Badge key={label} variant="secondary">{label}</Badge>
                        ))}
                    </div>
                </article>
            ))}
        </section>
    </CommonControlState>
);

/** Разделы по группам: переключатель открывает раздел (просмотр), у
 *  открытого — второй переключатель «Изменение». У группы — «всё сразу». */
const SectionsPicker: FC<{ value: string[]; onChange: (codes: string[]) => void }> = ({ value, onChange }) => (
    <div className="flex flex-col gap-3">
        {SECTION_GROUPS.map((group) => {
            const sections = SECTIONS.filter((s) => s.group === group);
            const opened = sections.filter((s) =>
                value.includes(perm(s.key, s.manageOnly ? PermissionAction.POST : PermissionAction.FETCH)),
            ).length;
            return (
                <section key={group} className="rounded-lg border">
                    <header className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
                        <span className="text-sm font-medium">
                            {group}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {opened} из {sections.length}
                            </span>
                        </span>
                        <Switch
                            aria-label={`${group}: все разделы`}
                            checked={opened === sections.length}
                            onCheckedChange={(on) => onChange(toggleSections(value, sections.map((s) => s.key), on))}
                        />
                    </header>
                    <ul className="divide-y">
                        {sections.map((section) => {
                            const canFetch = value.includes(perm(section.key, PermissionAction.FETCH));
                            const canPost = value.includes(perm(section.key, PermissionAction.POST));
                            const title = section.short ?? section.label;
                            if (section.manageOnly) {
                                return (
                                    <li key={section.key} className="flex items-center gap-3 px-3 py-2.5">
                                        <Switch
                                            aria-label={`${section.label}: расписание, заявки и модерация`}
                                            checked={canPost}
                                            onCheckedChange={(on) => onChange(toggleHallManagement(value, on))}
                                        />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className={canPost ? "text-sm font-medium" : "text-sm"}>{title}</span>
                                            <span className="text-xs text-muted-foreground">Доступ к общему расписанию, всем заявкам, редактированию и модерации</span>
                                            <code className="text-[11px] text-muted-foreground">Permission: {perm(section.key, PermissionAction.POST)}</code>
                                        </span>
                                    </li>
                                );
                            }
                            return (
                                <li key={section.key} className="flex items-center gap-3 px-3 py-2.5">
                                    <Switch
                                        aria-label={`${section.label}: открыть раздел`}
                                        checked={canFetch}
                                        onCheckedChange={(on) =>
                                            onChange(toggleSectionAction(value, section.key, PermissionAction.FETCH, on))
                                        }
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className={canFetch ? "text-sm font-medium" : "text-sm"}>{title}</span>
                                        <span className="text-xs text-muted-foreground">{section.description}</span>
                                            <code className="text-[11px] text-muted-foreground">Permission: {perm(section.key, PermissionAction.FETCH)}</code>
                                    </span>
                                    {canFetch && (
                                        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                                            {section.postLabel ?? ACTION_LABEL[PermissionAction.POST]}
                                            <code className="text-[11px]">{perm(section.key, PermissionAction.POST)}</code>
                                            <Switch
                                                size="sm"
                                                aria-label={`${section.label}: ${ACTION_LABEL[PermissionAction.POST]}`}
                                                checked={canPost}
                                                onCheckedChange={(on) =>
                                                    onChange(toggleSectionAction(value, section.key, PermissionAction.POST, on))
                                                }
                                            />
                                        </label>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            );
        })}
        <p className="text-xs text-muted-foreground">
            Включённый раздел виден в меню; «Изменение» — добавлять, править и удалять в нём.
        </p>
    </div>
);

/** Закупки v3: переключатель на каждое действие процесса. Чей отдел или
 *  направление — по профилю и справочнику проректоров, не здесь. */
const PurchasePermissionsPicker: FC<{ value: string[]; onChange: (codes: string[]) => void }> = ({ value, onChange }) => {
    const toggle = (codes: string[], on: boolean) => {
        const next = new Set(value);
        for (const code of codes) {
            if (on) next.add(code);
            else next.delete(code);
        }
        onChange([...next].sort());
    };
    return (
        <div className="flex flex-col gap-3">
            {PURCHASE_PERMISSION_GROUPS.map((group) => {
                const items = PURCHASE_PERMISSIONS.filter((p) => p.group === group);
                const codes = items.map((p) => purchasePerm(p.key));
                const granted = codes.filter((code) => value.includes(code)).length;
                return (
                    <section key={group} className="rounded-lg border">
                        <header className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2">
                            <span className="text-sm font-medium">
                                {group}
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                    {granted} из {items.length}
                                </span>
                            </span>
                            <Switch
                                aria-label={`${group}: все действия`}
                                checked={granted === items.length}
                                onCheckedChange={(on) => toggle(codes, on)}
                            />
                        </header>
                        <ul className="divide-y">
                            {items.map((item) => {
                                const code = purchasePerm(item.key);
                                const on = value.includes(code);
                                return (
                                    <li key={item.key} className="flex items-center gap-3 px-3 py-2.5">
                                        <Switch aria-label={item.label} checked={on} onCheckedChange={(next) => toggle([code], next)} />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className={on ? "text-sm font-medium" : "text-sm"}>{item.label}</span>
                                            <span className="text-xs text-muted-foreground">{item.description}</span>
                                            <code className="text-[11px] text-muted-foreground">Permission: {code}</code>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                );
            })}
            <p className="text-xs text-muted-foreground">
                Право даёт действие; отдел берётся из профиля сотрудника, направление проректора — из справочника закупок.
            </p>
        </div>
    );
};

interface UserPermissionGroupDialogProps {
    draft: UserPermissionGroupDraft | null;
    onClose: () => void;
    onSave: (draft: UserPermissionGroupDraft) => Promise<boolean>;
}
const UserPermissionGroupDialog: FC<UserPermissionGroupDialogProps> = ({ draft, onClose, onSave }) => (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            {/* key: свежая форма на каждый набор */}
            {draft && <UserPermissionGroupForm key={draft.id.toString()} initial={draft} onClose={onClose} onSave={onSave} />}
        </DialogContent>
    </Dialog>
);

const UserPermissionGroupForm: FC<{ initial: UserPermissionGroupDraft; onClose: () => void; onSave: UserPermissionGroupDialogProps["onSave"] }> = ({
    initial,
    onClose,
    onSave,
}) => {
    const [draft, setDraft] = useState(initial);
    const [saving, setSaving] = useState(false);


    return (
        <form
            className="flex flex-col gap-4"
            onSubmit={async (event) => {
                event.preventDefault();
                setSaving(true);
                if (await onSave(draft)) onClose();
                setSaving(false);
            }}
        >
            <DialogHeader>
                <DialogTitle>{initial.id === 0n ? "Новый доступ" : "Доступ"}</DialogTitle>
                <DialogDescription>
                    Отметьте разделы и действия. Изменения действуют у всех, кому доступ выдан (в течение 15 минут).
                </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
                <Label htmlFor="access-group-name">Название</Label>
                <Input
                    id="access-group-name"
                    required
                    maxLength={100}
                    placeholder="Например: Деканат"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="access-group-description">Описание</Label>
                <Textarea
                    id="access-group-description"
                    rows={2}
                    placeholder="Кому выдавать"
                    value={draft.description}
                    onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
            </div>
            <div className="flex flex-col gap-3">
                <Label>Разделы</Label>
                <SectionsPicker
                    value={draft.permissions}
                    onChange={(permissions) => setDraft((d) => ({ ...d, permissions }))}
                />
            </div>
            <div className="flex flex-col gap-3">
                <Label>Закупки — действия</Label>
                <PurchasePermissionsPicker
                    value={draft.permissions}
                    onChange={(permissions) => setDraft((d) => ({ ...d, permissions }))}
                />
            </div>
            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
                <Button type="submit" disabled={saving || draft.name.trim() === ""}>Сохранить</Button>
            </DialogFooter>
        </form>
    );
};

interface DeleteUserPermissionGroupDialogProps {
    group: UserPermissionGroup | null;
    onClose: () => void;
    onConfirm: (group: UserPermissionGroup) => Promise<void>;
}
const DeleteUserPermissionGroupDialog: FC<DeleteUserPermissionGroupDialogProps> = ({ group, onClose, onConfirm }) => (
    <Dialog open={group !== null} onOpenChange={(open) => !open && onClose()}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Удалить группу прав «{group?.name}»?</DialogTitle>
                <DialogDescription>
                    Группа будет снята со всех пользователей, которым она назначена.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Отмена</Button>
                <Button
                    variant="destructive"
                    onClick={async () => {
                        if (group) await onConfirm(group);
                        onClose();
                    }}
                >
                    Удалить
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

export { UserPermissionGroupDialog, UserPermissionGroupList, DeleteUserPermissionGroupDialog };
