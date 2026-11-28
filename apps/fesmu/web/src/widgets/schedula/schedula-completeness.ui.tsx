import { useEffect, useState } from "react";
import { ConnectError } from "@connectrpc/connect";
import type { Audience, CompletenessGap, Event, Term } from "@fesmu/contract/schedula/entity/schedule.entity_pb";
import { CompletenessGapType, EventStatus } from "@fesmu/contract/schedula/enum/schedule.enum_pb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { schedulaClient } from "./schedula.api";
import { dateLabel } from "./schedula.utils";

const gapLabel = {
    [CompletenessGapType.UNSPECIFIED]: "",
    [CompletenessGapType.COURSE]: "Курс без занятий",
    [CompletenessGapType.GROUP]: "Группа без занятий",
    [CompletenessGapType.SUBGROUP]: "Подгруппа без занятий",
    [CompletenessGapType.TIME]: "Нет времени",
    [CompletenessGapType.ROOM]: "Нет площадки",
    [CompletenessGapType.INSTRUCTOR]: "Нет преподавателя или наставника",
    [CompletenessGapType.CLINICAL_DETAILS]: "Не заполнен клинический день",
};

interface Props {
    terms: Term[];
    date?: string;
    onClose: () => void;
    onEvent?: (event: Event) => void;
    onAudience: (term: Term, audience: Audience) => void;
}

export function SchedulaCompleteness({ terms, date, onClose, onEvent, onAudience }: Props) {
    const [termId, setTerm] = useState(() => terms.find((term) => date && term.dateFrom <= date && date <= term.dateTo)?.id ?? terms.at(-1)?.id ?? "");
    const [state, setState] = useState<{ term: string; gaps?: CompletenessGap[]; error?: string }>();
    const term = terms.find((item) => item.id === termId);

    useEffect(() => {
        if (!termId) return;
        const controller = new AbortController();
        schedulaClient.completenessFetch({ termId }, { signal: controller.signal }).then(
            (result) => { if (!controller.signal.aborted) setState({ term: termId, gaps: result.gaps }); },
            (cause: unknown) => { if (!controller.signal.aborted) setState({ term: termId, error: ConnectError.from(cause).rawMessage }); },
        );
        return () => controller.abort();
    }, [termId]);

    return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>Полнота расписания</DialogTitle></DialogHeader>
            {!terms.length ? <p className="text-muted-foreground">Добавьте семестр в справочники.</p> : <>
                <label className="grid gap-1 font-medium">Семестр
                    <select className="h-9 rounded-md border bg-background px-2 text-sm" value={termId} onChange={(e) => setTerm(e.target.value)}>
                        {terms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                </label>
                {state?.term !== termId ? <p className="text-muted-foreground">Проверяем заполнение…</p> :
                    state.error ? <p role="alert" className="text-destructive">{state.error}</p> :
                        state.gaps?.length ? <ul className="space-y-2">{state.gaps.map((gap, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2">
                            <div>
                                <p className="font-medium">{gapLabel[gap.type]}</p>
                                <p className="text-xs text-muted-foreground">{gap.audience
                                    ? [`${gap.audience.course}-й курс`, gap.audience.group, gap.audience.subgroup].filter(Boolean).join(" · ")
                                    : [gap.event?.subject?.name, dateLabel(gap.event?.details?.date ?? "")].filter(Boolean).join(" · ")}</p>
                            </div>
                            {gap.event?.status === EventStatus.DRAFT && onEvent && <Button size="sm" variant="outline" onClick={() => { if (gap.event) onEvent(gap.event); }}>Открыть черновик</Button>}
                            {term && gap.audience && <Button size="sm" variant="outline" onClick={() => { if (gap.audience) onAudience(term, gap.audience); }}>Открыть расписание</Button>}
                        </li>)}</ul> : <p className="text-muted-foreground">Пропусков в назначениях групп, времени, площадках и обязательных данных занятий не обнаружено.</p>}
            </>}
        </DialogContent>
    </Dialog>;
}
