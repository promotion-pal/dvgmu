import type { FC } from "react";
import { Link, generatePath } from "react-router-dom";
import { BookOpenTextIcon, PencilIcon } from "lucide-react";
import type { Manual, ManualCard } from "@/features/library";
import { Can } from "@/features/access";
import { CommonFilterSelect, CommonSearchInput } from "@/shared/components/filter";
import { CommonModal } from "@/shared/components/modal";
import { PermissionSection } from "@/shared/config/permissions";
import { ROUTE } from "@/shared/config/path";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import type { ManualListState } from "./manual.fn";
import { STATUS_LABEL, manualMeta } from "./manual.lib";


export const ManualStatusBadge: FC<{ manual: Pick<Manual, "status" | "draftChanged"> }> = ({ manual }) => (
    <span className="flex flex-wrap gap-1">
        <Badge variant={manual.status === "published" ? "default" : manual.status === "archived" ? "outline" : "secondary"}>{STATUS_LABEL[manual.status]}</Badge>
        {manual.status !== "draft" && manual.draftChanged && <Badge variant="outline">Есть неопубликованные правки</Badge>}
    </span>
);


export const ManualFilters: FC<{ state: ManualListState }> = ({ state }) => (
    <>
        <CommonSearchInput value={state.query} onChange={state.setQuery} placeholder="Название, автор…" />
        <CommonFilterSelect
            label="Дисциплина"
            value={state.discipline}
            onChange={state.setDiscipline}
            allLabel="Все дисциплины"
            options={state.disciplines.map((d) => ({ value: d, label: d }))}
        />
    </>
);

export const ManualList: FC<{ state: ManualListState }> = ({ state }) => (
    <div className="space-y-8">
        {state.groups.map(([discipline, list]) => (
            <section key={discipline}>
                <h3 className="mb-3 text-lg font-semibold">{discipline}</h3>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((m) => (
                        <article key={m.id} className="flex flex-col rounded-xl border p-4">
                            <div className="flex items-start gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <BookOpenTextIcon className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium">{m.title}</div>
                                    <div className="text-sm text-muted-foreground">{manualMeta(m)}</div>
                                    {m.authors && <div className="mt-0.5 text-sm text-muted-foreground">{m.authors}</div>}
                                </div>
                            </div>
                            {m.annotation && <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{m.annotation}</p>}
                            <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                                <Can section={PermissionSection.MANUALS}>
                                    <ManualStatusBadge manual={m} />
                                </Can>
                                <div className="ml-auto flex gap-2">
                                    <Can section={PermissionSection.MANUALS}>
                                        <Button variant="outline" size="sm" asChild>
                                            <Link to={generatePath(ROUTE.LIBRARY.MANUAL_EDIT, { id: m.id })}><PencilIcon />Править</Link>
                                        </Button>
                                    </Can>
                                    {m.status === "published" && (
                                        <Button size="sm" asChild>
                                            <Link to={generatePath(ROUTE.LIBRARY.MANUAL, { id: m.id })}>Читать</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>
        ))}
    </div>
);

/** Поля карточки методички — в окне создания и в редакторе. */
export const ManualCardFields: FC<{ card: ManualCard; onChange: (card: ManualCard) => void; disciplines: string[] }> = ({ card, onChange, disciplines }) => {
    const set = (patch: Partial<ManualCard>) => onChange({ ...card, ...patch });
    return (
        <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <Label>Дисциплина</Label>
                    <Input value={card.discipline} onChange={(e) => set({ discipline: e.target.value })} list="manual-disciplines" placeholder="Анатомия человека" required />
                    <datalist id="manual-disciplines">{disciplines.map((d) => <option key={d} value={d} />)}</datalist>
                </div>
                <div className="grid gap-1.5">
                    <Label>Специальность</Label>
                    <Input value={card.specialty} onChange={(e) => set({ specialty: e.target.value })} placeholder="Лечебное дело" />
                </div>
            </div>
            <div className="grid gap-1.5">
                <Label>Название</Label>
                <Input value={card.title} onChange={(e) => set({ title: e.target.value })} placeholder="Методические указания к практическим занятиям" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                    <Label>Курс</Label>
                    <Input type="number" min={1} max={6} value={card.course || ""} onChange={(e) => set({ course: Number(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-1.5">
                    <Label>Семестр</Label>
                    <Input type="number" min={1} max={12} value={card.semester || ""} onChange={(e) => set({ semester: Number(e.target.value) || 0 })} />
                </div>
                <div className="grid gap-1.5">
                    <Label>Авторы</Label>
                    <Input value={card.authors} onChange={(e) => set({ authors: e.target.value })} />
                </div>
            </div>
            <div className="grid gap-1.5">
                <Label>Аннотация</Label>
                <Textarea rows={3} value={card.annotation} onChange={(e) => set({ annotation: e.target.value })} />
            </div>
        </div>
    );
};

export const ManualCreateModal: FC<{ state: ManualListState; onCreated: (id: string) => void }> = ({ state, onCreated }) => {
    const f = state.createForm;
    return (
        <CommonModal open={f.open} onOpenChange={f.setOpen} title="Новая методичка" description="Карточку можно поправить позже; темы и блоки — в редакторе." className="sm:max-w-2xl">
            <form
                className="grid gap-4"
                onSubmit={async (e) => {
                    e.preventDefault();
                    const id = await state.create();
                    if (id) onCreated(id);
                }}
            >
                <ManualCardFields card={f.card} onChange={f.setCard} disciplines={state.disciplines} />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => f.setOpen(false)}>Отмена</Button>
                    <Button type="submit" disabled={f.saving}>{f.saving ? "Создаём…" : "Создать и открыть редактор"}</Button>
                </div>
            </form>
        </CommonModal>
    );
};
