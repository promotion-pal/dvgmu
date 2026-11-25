import { useEffect, useState } from "react";
import type { FC } from "react";
import { Link, generatePath, useNavigate } from "react-router-dom";
import { ArchiveIcon, ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, CopyIcon, EyeIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SaveIcon, SendIcon, Trash2Icon } from "lucide-react";
import { libraryApi } from "@/features/library";
import type { Block, BlockKind } from "@/shared/blocks";
import { BLOCK_KINDS, BLOCKS, BlockEdit, BlocksEnvProvider } from "@/shared/blocks";
import { CommonControlState } from "@/shared/components/state";
import { CommonModal } from "@/shared/components/modal";
import { ROUTE } from "@/shared/config/path";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { useManualEditor } from "./manual.editor.fn";
import type { ManualEditorState } from "./manual.editor.fn";
import { useEditEnv } from "./manual.env";
import { manualMeta } from "./manual.lib";
import { ManualCardFields, ManualStatusBadge } from "./manual.ui";

/** Меню «добавить блок» — все виды из реестра. */
const AddBlock: FC<{ onPick: (kind: BlockKind) => void; compact?: boolean }> = ({ onPick, compact }) => (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
            {compact ? (
                <button type="button" className="group flex w-full items-center gap-2 py-1 text-xs text-muted-foreground" aria-label="Добавить блок">
                    <span className="h-px flex-1 bg-border opacity-0 transition-opacity group-hover:opacity-100" />
                    <PlusIcon className="size-4 rounded-full border bg-background opacity-40 transition-opacity group-hover:opacity-100" />
                    <span className="h-px flex-1 bg-border opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
            ) : (
                <Button variant="outline" className="w-full border-dashed"><PlusIcon />Добавить блок</Button>
            )}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-96 w-72 overflow-y-auto" align="center">
            {BLOCK_KINDS.map((kind) => {
                const { icon: Icon, label, hint } = BLOCKS[kind];
                return (
                    <DropdownMenuItem key={kind} onSelect={() => onPick(kind)} className="items-start gap-3">
                        <Icon className="mt-0.5 size-4" />
                        <span>
                            <span className="block text-sm">{label}</span>
                            <span className="block text-xs text-muted-foreground">{hint}</span>
                        </span>
                    </DropdownMenuItem>
                );
            })}
        </DropdownMenuContent>
    </DropdownMenu>
);

const BlockCard: FC<{ block: Block; index: number; total: number; state: ManualEditorState }> = ({ block, index, total, state }) => {
    const { icon: Icon, label } = BLOCKS[block.kind];
    return (
        <div className="group rounded-xl border bg-card p-3 transition-shadow focus-within:shadow-sm hover:shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-3.5" />
                <span>{label}</span>
                <div className="ml-auto flex opacity-60 transition-opacity group-hover:opacity-100">
                    <Button variant="ghost" size="icon-xs" aria-label="Выше" disabled={index === 0} onClick={() => state.blockOps.move(block.id, -1)}><ArrowUpIcon /></Button>
                    <Button variant="ghost" size="icon-xs" aria-label="Ниже" disabled={index === total - 1} onClick={() => state.blockOps.move(block.id, 1)}><ArrowDownIcon /></Button>
                    <Button variant="ghost" size="icon-xs" aria-label="Дублировать" onClick={() => state.blockOps.duplicate(block.id)}><CopyIcon /></Button>
                    <Button variant="ghost" size="icon-xs" aria-label="Удалить блок" onClick={() => state.blockOps.remove(block.id)}><Trash2Icon /></Button>
                </div>
            </div>
            <BlockEdit block={block} onChange={state.blockOps.change} />
        </div>
    );
};

const SectionsPanel: FC<{ state: ManualEditorState }> = ({ state }) => (
    <aside className="w-full shrink-0 space-y-1 lg:sticky lg:top-[8.5rem] lg:max-h-[calc(100vh-9rem)] lg:w-72 lg:overflow-y-auto">
        <div className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Темы</div>
        {state.sections.map((s, i) => (
            <div
                key={s.id}
                className={cn("group flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-muted", state.activeId === s.id && "bg-muted")}
            >
                <button type="button" onClick={() => state.setActiveId(s.id)} className={cn("min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm", state.activeId === s.id && "font-medium")}>
                    <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>{s.title || "Без названия"}
                </button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-xs" className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" aria-label="Действия с темой"><MoreHorizontalIcon /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled={i === 0} onSelect={() => state.sectionOps.move(s.id, -1)}><ArrowUpIcon />Выше</DropdownMenuItem>
                        <DropdownMenuItem disabled={i === state.sections.length - 1} onSelect={() => state.sectionOps.move(s.id, 1)}><ArrowDownIcon />Ниже</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => state.sectionOps.remove(s.id)}><Trash2Icon />Удалить тему</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        ))}
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={state.sectionOps.add}><PlusIcon />Тема</Button>
    </aside>
);

/* Редактор методички: слева темы, справа блоки выбранной темы; каждый блок
 * правится своим компонентом из реестра (shared/blocks). Сверху — карточка,
 * сохранение черновика, предпросмотр и публикация. */
export const ManualEditor: FC<{ id: string }> = ({ id }) => {
    const state = useManualEditor(id);
    const env = useEditEnv();
    const navigate = useNavigate();
    const [cardOpen, setCardOpen] = useState(false);
    const [disciplines, setDisciplines] = useState<string[]>([]);

    useEffect(() => {
        libraryApi.disciplines().then(setDisciplines, () => {});
    }, []);

    const { manual, card, active } = state;

    return (
        <div className="w-full min-w-0">
            <div className="sticky top-16 z-40 border-b bg-background/95 backdrop-blur">
                <div className="flex min-h-14 flex-wrap items-center gap-2 px-3 py-2 sm:px-6">
                    <Button variant="ghost" size="icon-sm" asChild aria-label="К методичкам">
                        <Link to={ROUTE.LIBRARY.MANUALS}><ArrowLeftIcon /></Link>
                    </Button>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="truncate font-semibold">{card?.title || "Методичка"}</span>
                            <Button variant="ghost" size="icon-xs" aria-label="Карточка методички" onClick={() => setCardOpen(true)}><PencilIcon /></Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {card && <span>{[card.discipline, manualMeta(card)].filter(Boolean).join(" · ")}</span>}
                            {manual && <ManualStatusBadge manual={manual} />}
                            {state.dirty && <span className="text-amber-600">Не сохранено</span>}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                            <Link to={`${generatePath(ROUTE.LIBRARY.MANUAL, { id })}?draft=1`} onClick={(e) => state.dirty && !window.confirm("Есть несохранённые правки — предпросмотр покажет последний сохранённый черновик. Открыть?") && e.preventDefault()}>
                                <EyeIcon />Предпросмотр
                            </Link>
                        </Button>
                        <Button variant="outline" size="sm" disabled={!state.dirty || state.busy} onClick={() => state.save()}><SaveIcon />Сохранить</Button>
                        <Button size="sm" disabled={state.busy || (manual?.status === "published" && !manual.draftChanged && !state.dirty)} onClick={state.publish}>
                            <SendIcon />Опубликовать
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="Ещё"><MoreHorizontalIcon /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setCardOpen(true)}><PencilIcon />Карточка методички</DropdownMenuItem>
                                <DropdownMenuItem disabled={manual?.status !== "published"} onSelect={state.archive}><ArchiveIcon />Снять с публикации</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={async () => (await state.remove()) && navigate(ROUTE.LIBRARY.MANUALS)}><Trash2Icon />Удалить методичку</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>

            <CommonControlState isLoading={state.loading} isError={state.error} isEmpty={false} styleWrapper="px-4 py-6">
                <BlocksEnvProvider value={env}>
                    <div className="flex flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
                        <SectionsPanel state={state} />
                        <div className="mx-auto w-full min-w-0 max-w-3xl">
                            {!active ? (
                                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
                                    <p className="text-sm text-muted-foreground">В методичке пока нет тем. Начните с первой — например, «Остеология».</p>
                                    <Button onClick={state.sectionOps.add}><PlusIcon />Добавить тему</Button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Input
                                        value={active.title}
                                        onChange={(e) => state.sectionOps.rename(active.id, e.target.value)}
                                        placeholder="Название темы"
                                        className="mb-4 h-12 border-0 border-b px-0 text-2xl font-bold shadow-none focus-visible:ring-0 md:text-2xl"
                                    />
                                    {active.blocks.map((b, i) => (
                                        <div key={b.id}>
                                            {i > 0 && <AddBlock compact onPick={(kind) => state.blockOps.insert(kind, i)} />}
                                            <BlockCard block={b} index={i} total={active.blocks.length} state={state} />
                                        </div>
                                    ))}
                                    <div className="pt-3">
                                        <AddBlock onPick={(kind) => state.blockOps.insert(kind, active.blocks.length)} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </BlocksEnvProvider>
            </CommonControlState>

            {card && (
                <CommonModal open={cardOpen} onOpenChange={setCardOpen} title="Карточка методички" description="Изменения попадут в черновик — сохраните его." className="sm:max-w-2xl">
                    <ManualCardFields card={card} onChange={state.setCard} disciplines={disciplines} />
                    <div className="flex justify-end"><Button onClick={() => setCardOpen(false)}>Готово</Button></div>
                </CommonModal>
            )}
        </div>
    );
};
