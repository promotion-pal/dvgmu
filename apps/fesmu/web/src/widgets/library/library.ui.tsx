import type { FC } from "react";
import { Link, generatePath } from "react-router-dom";
import { BookIcon, BookOpenTextIcon, ExternalLinkIcon, FileTextIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import type { LibraryItem } from "@/features/library";
import { Can } from "@/features/access";
import { CommonModal } from "@/shared/components/modal";
import { CommonFilterSelect, CommonSearchInput } from "@/shared/components/filter";
import { PermissionSection } from "@/shared/config/permissions";
import { ROUTE } from "@/shared/config/path";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import type { LibraryCatalogState } from "./library.fn";
import { itemHref } from "./library.lib";

export const LibraryFilters: FC<{ state: LibraryCatalogState }> = ({ state }) => (
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

/** «Продолжить чтение» — последние открытые издания и методички. */
export const LibraryContinue: FC<{ state: LibraryCatalogState }> = ({ state }) => {
    if (state.recent.length === 0) return null;
    return (
        <section className="mb-8">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Продолжить чтение</h3>
            <div className="flex gap-3 overflow-x-auto pb-1">
                {state.recent.map((p) => (
                    <Link
                        key={`${p.kind}-${p.refId}`}
                        to={generatePath(p.kind === "manual" ? ROUTE.LIBRARY.MANUAL : ROUTE.LIBRARY.ITEM, { id: p.refId })}
                        className="w-60 shrink-0 rounded-xl border p-3 transition-colors hover:bg-muted/50"
                    >
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {p.kind === "manual" ? <BookOpenTextIcon className="size-3.5" /> : <BookIcon className="size-3.5" />}
                            {p.kind === "manual" ? "Методичка" : "Издание"}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm font-medium">{p.title}</div>
                        <div className="mt-2 h-1 rounded bg-muted">
                            <div className="h-full rounded bg-primary" style={{ width: `${p.percent}%` }} />
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
};

const ItemIcon: FC<{ it: LibraryItem }> = ({ it }) => {
    const Icon = it.kind === "link" ? LinkIcon : it.file?.mimeType === "application/pdf" ? FileTextIcon : BookIcon;
    return (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
        </div>
    );
};

const formatOf = (it: LibraryItem) =>
    it.kind === "link" ? "Ссылка" : (it.file?.name.split(".").pop() ?? "").toUpperCase();

export const LibraryList: FC<{ state: LibraryCatalogState }> = ({ state }) => (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {state.visible.map((it) => (
            <article key={it.id} className="flex gap-3 rounded-xl border p-4">
                <ItemIcon it={it} />
                <div className="min-w-0 flex-1">
                    <a
                        href={itemHref(it)}
                        target={it.kind === "link" ? "_blank" : undefined}
                        rel={it.kind === "link" ? "noreferrer noopener" : undefined}
                        className="line-clamp-2 font-medium hover:underline"
                    >
                        {it.title}
                        {it.kind === "link" && <ExternalLinkIcon className="ml-1 inline size-3.5 text-muted-foreground" />}
                    </a>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                        {[it.authors, it.publisher, it.year || ""].filter(Boolean).join(" · ")}
                    </div>
                    {it.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{it.description}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {it.discipline && <Badge variant="secondary">{it.discipline}</Badge>}
                        <Badge variant="outline">{formatOf(it)}</Badge>
                        <Can section={PermissionSection.LIBRARY}>
                            <div className="ml-auto flex gap-1">
                                <Button variant="ghost" size="icon-sm" aria-label="Изменить" onClick={() => state.openEdit(it)}><PencilIcon /></Button>
                                <Button variant="ghost" size="icon-sm" aria-label="Удалить" onClick={() => state.remove(it)}><Trash2Icon /></Button>
                            </div>
                        </Can>
                    </div>
                </div>
            </article>
        ))}
    </div>
);

export const LibraryItemFormModal: FC<{ state: LibraryCatalogState }> = ({ state }) => {
    const { form } = state;
    const v = form.input;
    const set = (patch: Partial<typeof v>) => form.setInput({ ...v, ...patch });
    return (
        <CommonModal
            open={form.open}
            onOpenChange={form.setOpen}
            title={form.editing ? "Издание" : "Новое издание"}
            description="Файл (PDF, EPUB, DOCX) откроется в читалке или будет доступен для скачивания; ссылка ведёт на внешний ресурс."
            className="sm:max-w-2xl"
        >
            <form
                className="grid gap-4"
                onSubmit={(e) => {
                    e.preventDefault();
                    form.save();
                }}
            >
                {!form.editing && (
                    <div className="flex gap-2">
                        <Button type="button" variant={v.kind === "file" ? "default" : "outline"} size="sm" onClick={() => set({ kind: "file" })}>Файл</Button>
                        <Button type="button" variant={v.kind === "link" ? "default" : "outline"} size="sm" onClick={() => set({ kind: "link" })}>Ссылка</Button>
                    </div>
                )}
                <div className="grid gap-1.5">
                    <Label>Название</Label>
                    <Input value={v.title} onChange={(e) => set({ title: e.target.value })} required />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                        <Label>Авторы</Label>
                        <Input value={v.authors} onChange={(e) => set({ authors: e.target.value })} placeholder="Сапин М. Р., Билич Г. Л." />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Дисциплина</Label>
                        <Input value={v.discipline} onChange={(e) => set({ discipline: e.target.value })} list="library-disciplines" placeholder="Анатомия" />
                        <datalist id="library-disciplines">{state.disciplines.map((d) => <option key={d} value={d} />)}</datalist>
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Издательство</Label>
                        <Input value={v.publisher} onChange={(e) => set({ publisher: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label>Год</Label>
                        <Input type="number" value={v.year || ""} onChange={(e) => set({ year: Number(e.target.value) || 0 })} min={1800} max={2100} />
                    </div>
                </div>
                <div className="grid gap-1.5">
                    <Label>Описание</Label>
                    <Textarea rows={3} value={v.description} onChange={(e) => set({ description: e.target.value })} />
                </div>
                {v.kind === "link" ? (
                    <div className="grid gap-1.5">
                        <Label>Ссылка</Label>
                        <Input type="url" value={v.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" required />
                    </div>
                ) : (
                    <div className="grid gap-1.5">
                        <Label>{form.editing?.file ? `Файл: ${form.editing.file.name} — выберите новый, чтобы заменить` : "Файл"}</Label>
                        <Input type="file" accept=".pdf,.epub,.docx" onChange={(e) => form.setFile(e.target.files?.[0])} required={!form.editing} />
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => form.setOpen(false)}>Отмена</Button>
                    <Button type="submit" disabled={form.saving}>{form.saving ? "Сохраняем…" : "Сохранить"}</Button>
                </div>
            </form>
        </CommonModal>
    );
};
