import { useEffect, useState } from "react";
import { BookMarkedIcon, BookOpenIcon, RefreshCwIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTE } from "@/shared/config/path";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
    PurchaseActorBar,
    PurchaseActualLots,
    PurchaseDirectories,
    PurchaseActorRole,
    PurchaseCommissionBoard,
    PurchaseList,
    PurchaseLotDetail,
    PurchaseMergeModal,
    PurchaseRequestDetail,
    PurchaseRequestFormModal,
    PurchaseStats,
    usePurchaseV2,
} from "@/widgets/purchase-v2";
import type { MergeMode } from "@/widgets/purchase-v2";

/** Purchases v2: employee → head of their department → vice-rector over it →
 * implementing department (merging, assignee, offers, check) → vice-rector →
 * economists → budget commission → ПФХД, acted out by role. */
export default function PurchaseV2Page() {
    const state = usePurchaseV2();
    const [form, setForm] = useState<{ open: boolean; editId?: string }>({ open: false });
    const [merging, setMerging] = useState<MergeMode>();
    const [directories, setDirectories] = useState(false);

    useEffect(() => {
        state.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isCommission = state.actor.role === PurchaseActorRole.BUDGET_COMMISSION;
    const detail = state.activeRequest ? (
        <PurchaseRequestDetail state={state} r={state.activeRequest} onEdit={() => setForm({ open: true, editId: state.activeRequest!.id })} />
    ) : state.activeLot ? (
        <PurchaseLotDetail state={state} lot={state.activeLot} />
    ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
            {isCommission ? "Выберите закупку в таблице, чтобы увидеть КП, заявки и историю." : "Выберите заявку или закупку слева."}
        </Card>
    );

    return (
        <CommonWrapper
            title="Закупки — демо"
            description="Демонстрация прежнего процесса (v2), рабочие закупки — в разделе «Закупки». Заявка сотрудника → начальник отдела → курирующий проректор → реализующий отдел (характеристики, КП) → проректор → экономисты → бюджетная комиссия → ПФХД"
            action={
                <div className="flex gap-2">
                    {state.me.admin && (
                        <Button variant={directories ? "secondary" : "outline"} size="sm" onClick={() => setDirectories((d) => !d)}>
                            <BookMarkedIcon className="size-4" /> Справочники
                        </Button>
                    )}
                    <Button variant="outline" size="sm" asChild>
                        <Link to={`${ROUTE.DOCS.COMMON}?doc=purchases-flow`} target="_blank">
                            <BookOpenIcon className="size-4" /> Инструкция
                        </Link>
                    </Button>
                    <Button variant="outline" size="sm" disabled={state.loading} onClick={() => state.fetch()}>
                        <RefreshCwIcon className="size-4" /> Обновить
                    </Button>
                </div>
            }
        >
            <CommonControlState isLoading={state.loading && state.overview.curators.length === 0} isError={state.error} isEmpty={false}>
                <div className="flex flex-col gap-4">
                    <PurchaseActorBar state={state} />
                    {directories && <PurchaseDirectories state={state} />}
                    <PurchaseStats state={state} />
                    {state.actor.role === PurchaseActorRole.VICE_RECTOR && <PurchaseActualLots state={state} />}

                    {isCommission ? (
                        <>
                            <PurchaseCommissionBoard state={state} />
                            <div className="flex flex-col gap-4">{detail}</div>
                        </>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
                            <PurchaseList state={state} onNewRequest={() => setForm({ open: true })} onMerge={setMerging} />
                            <div className="flex min-w-0 flex-col gap-4">{detail}</div>
                        </div>
                    )}
                </div>
            </CommonControlState>

            <PurchaseRequestFormModal
                state={state}
                open={form.open}
                onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
                initial={form.editId ? state.requestById(form.editId) : undefined}
            />
            <PurchaseMergeModal state={state} mode={merging ?? "lot"} open={Boolean(merging)} onOpenChange={(open) => !open && setMerging(undefined)} />
        </CommonWrapper>
    );
}
