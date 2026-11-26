import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTE } from "@/shared/config/path";
import { ArrowLeftIcon, BookMarkedIcon, BookOpenIcon, ClipboardListIcon, InboxIcon, LandmarkIcon, LayersIcon, PieChartIcon, PlayCircleIcon, RefreshCwIcon, UsersIcon } from "lucide-react";
import type { ComponentType } from "react";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
    ActivityView,
    CodeTree,
    CommissionView,
    DirectoriesView,
    LotDetail,
    MergeModal,
    PurchaseFilterBar,
    PurchaseList,
    PurchaseMeCard,
    PurchasePermission,
    RequestDetail,
    RequestFormModal,
    SummaryView,
    usePurchaseV3,
} from "@/widgets/purchase-v3";
import type { MergeMode, PurchaseView } from "@/widgets/purchase-v3";

/** Purchases v3, by the regulation: from an employee's request through the
 * budget commission to the contract, acceptance and the inventory. What the
 * user sees and may do comes from their access rights, department and
 * vice-rector direction — the server decides, the page shows. */
/** Видеоинструкция по разделу «Закупки» (Яндекс Диск). */
const VIDEO_GUIDE_URL = "https://disk.yandex.ru/d/hDGHsTIl-FPAPQ";

export default function PurchaseV3Page() {
    const state = usePurchaseV3();
    const [form, setForm] = useState<{ open: boolean; editId?: bigint }>({ open: false });
    const [merge, setMerge] = useState<{ mode?: MergeMode; ids: bigint[] }>({ ids: [] });
    const { can, view, setView } = state;

    useEffect(() => {
        state.fetch(false, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tabs: { key: PurchaseView; label: string; icon: ComponentType<{ className?: string }>; count?: number; shown: boolean }[] = [
        { key: "tasks", label: "Мои задачи", icon: InboxIcon, count: state.allTasks, shown: true },
        { key: "requests", label: "Заявки", icon: ClipboardListIcon, count: state.openRequests, shown: true },
        { key: "lots", label: "Закупки", icon: LayersIcon, count: state.lots.length, shown: true },
        {
            key: "summary",
            label: "Сводка",
            icon: PieChartIcon,
            shown: can(PurchasePermission.VIEW_DIRECTION) || can(PurchasePermission.VIEW_ALL) || can(PurchasePermission.VIEW_DEPARTMENT),
        },
        { key: "activity", label: "Сотрудники", icon: UsersIcon, shown: can(PurchasePermission.VIEW_ACTIVITY) },
        { key: "commission", label: "Комиссия и ПФХД", icon: LandmarkIcon, shown: can(PurchasePermission.LOT_COMMISSION) || can(PurchasePermission.VIEW_PLAN) },
        { key: "directories", label: "Справочники", icon: BookMarkedIcon, shown: can(PurchasePermission.DIRECTORIES) },
    ];

    const listView = view === "tasks" || view === "requests" || view === "lots";
    const detail = state.activeRequest ? (
        <RequestDetail key={state.activeRequest.id.toString()} state={state} r={state.activeRequest} onEdit={() => setForm({ open: true, editId: state.activeRequest!.id })} />
    ) : state.activeLot ? (
        <LotDetail key={state.activeLot.id.toString()} state={state} l={state.activeLot} />
    ) : (
        <Card className="flex min-h-40 items-center justify-center p-6 text-center text-sm text-muted-foreground">Выберите заявку или закупку в списке слева.</Card>
    );

    return (
        <CommonWrapper
            title="Закупки"
            description="От заявки сотрудника до приёмки и учёта в инвентаре — по регламенту закупок"
            action={
                <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild>
                        <a href={VIDEO_GUIDE_URL} target="_blank" rel="noopener noreferrer">
                            <PlayCircleIcon className="size-4" /> Видеоинструкция
                        </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <Link to={`${ROUTE.DOCS.COMMON}?doc=purchases-access-model`} target="_blank">
                            <BookOpenIcon className="size-4" /> Инструкция
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" disabled={state.loading} onClick={() => state.fetch()}>
                        <RefreshCwIcon className="size-4" /> Обновить
                    </Button>
                </div>
            }
        >
            <CommonControlState isLoading={state.loading && !state.overview} isError={Boolean(state.error) && !state.overview} isEmpty={false}>
                <div className="flex flex-col gap-4">
                    <PurchaseMeCard state={state} />

                    <nav className="flex flex-wrap gap-1 border-b pb-2" aria-label="Разделы закупок">
                        {tabs
                            .filter((t) => t.shown)
                            .map((t) => (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => setView(t.key)}
                                    className={cn(
                                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                                        view === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                                    )}
                                >
                                    <t.icon className="size-4" />
                                    {t.label}
                                    {t.count !== undefined && t.count > 0 && (
                                        <span className={cn("rounded-full px-1.5 text-xs", view === t.key ? "bg-primary-foreground/20" : "bg-muted")}>{t.count}</span>
                                    )}
                                </button>
                            ))}
                    </nav>

                    {(listView || view === "summary") && <PurchaseFilterBar state={state} />}
                    {listView && (
                        view === "lots" && state.lotLayout === "cards" ? (
                            state.activeLot ? (
                                <div className="flex min-w-0 flex-col gap-3">
                                    <Button size="sm" variant="outline" className="self-start" onClick={() => state.select(undefined)}>
                                        <ArrowLeftIcon className="size-4" /> К карточкам закупок
                                    </Button>
                                    <LotDetail state={state} l={state.activeLot} />
                                </div>
                            ) : (
                                <PurchaseList
                                    state={state}
                                    onNewRequest={() => setForm({ open: true })}
                                    onMerge={(mode, ids) => setMerge({ mode, ids })}
                                />
                            )
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                                <PurchaseList
                                    state={state}
                                    onNewRequest={() => setForm({ open: true })}
                                    onMerge={(mode, ids) => setMerge({ mode, ids })}
                                    lotsContent={state.lotLayout === "okpd2" || state.lotLayout === "ktru" ? <CodeTree state={state} lots={state.filteredLots} mode={state.lotLayout} /> : undefined}
                                />
                                <div className="flex min-w-0 flex-col gap-4">{detail}</div>
                            </div>
                        )
                    )}
                    {view === "summary" && <SummaryView state={state} />}
                    {view === "activity" && <ActivityView state={state} />}
                    {view === "commission" && <CommissionView state={state} />}
                    {view === "directories" && <DirectoriesView state={state} />}
                </div>
            </CommonControlState>
            {state.error && state.overview === undefined && <p className="mt-2 text-sm text-red-600">{state.error}</p>}

            <RequestFormModal
                state={state}
                open={form.open}
                onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
                initial={form.editId ? state.requestById(form.editId) : undefined}
            />
            <MergeModal state={state} mode={merge.mode} ids={merge.ids} onClose={() => setMerge({ ids: [] })} />
        </CommonWrapper>
    );
}
