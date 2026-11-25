import { useEffect, useState } from "react";
import { KeyRoundIcon, XIcon } from "lucide-react";
import type { DeaneryStudent } from "@fesmu/contract/fesmu/service/v1/deanery.service_pb";
import { useCan } from "@/features/access";
import { CommonFilterSelect, CommonSearchInput } from "@/shared/components/filter";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonWrapper } from "@/shared/components/wrapper";
import { PermissionAction, PermissionSection } from "@/shared/config/permissions";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import {
    ConfirmIssueDialog,
    DeaneryGroupCard,
    IssuedDialog,
    MAX_ISSUE,
    printActivationSheet,
    useActivationIssue,
    useDeaneryStudents,
} from "@/widgets/deanery";

/** Сколько групп показать сразу; остальные — после уточнения фильтра. */
const GROUPS_SHOWN = 30;

export default function DeaneryStudentsPage() {
    const d = useDeaneryStudents();
    const issuer = useActivationIssue();
    const canIssue = useCan(PermissionSection.DEANERY, PermissionAction.POST);
    const [confirm, setConfirm] = useState<DeaneryStudent[] | null>(null);

    useEffect(() => {
        void d.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const faculty = !d.scope.all && d.scope.faculties.length === 1 ? d.scope.faculties[0] : "";
    const scopeText = d.scope.all ? "все факультеты" : d.scope.faculties.join(", ");
    const shown = d.grouped.slice(0, GROUPS_SHOWN);

    const issue = async (students: DeaneryStudent[]) => {
        const codes = await issuer.issue(students.map((s) => s.userId));
        setConfirm(null);
        if (!codes) return;
        d.clearSelection();
        printActivationSheet(codes, faculty);
    };

    return (
        <CommonWrapper
            title="Студенты и входы"
            description={`Студенты по группам и курсам. Выберите группу или студентов и выдайте коды первого входа в личный кабинет — откроется лист для печати с логином и кодом. Видны студенты: ${scopeText}.`}
            action={
                canIssue &&
                d.selectedStudents.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" onClick={d.clearSelection}>
                            <XIcon className="size-4" />
                            Снять выбор
                        </Button>
                        <Button
                            disabled={issuer.sending || d.selectedStudents.length > MAX_ISSUE}
                            onClick={() => setConfirm(d.selectedStudents)}
                        >
                            <KeyRoundIcon className="size-4" />
                            Выдать коды ({d.selectedStudents.length})
                        </Button>
                    </div>
                )
            }
            filter={{
                render: {
                    count: d.filtered.length,
                    children: (
                        <>
                            <CommonSearchInput
                                value={d.filters.search}
                                onChange={(search) => d.changeFilters({ search })}
                                placeholder="ФИО, логин, зачётка, группа"
                            />
                            <CommonFilterSelect
                                label="Курс"
                                value={d.filters.course ? String(d.filters.course) : undefined}
                                onChange={(v) => d.changeFilters({ course: v ? Number(v) : undefined })}
                                options={d.courses.map((c) => ({ value: String(c), label: `${c} курс` }))}
                                allLabel="Все курсы"
                            />
                            <CommonFilterSelect
                                label="Группа"
                                value={d.filters.group}
                                onChange={(group) => d.changeFilters({ group })}
                                options={d.groups.map((g) => ({ value: g, label: g }))}
                                allLabel="Все группы"
                            />
                            <div className="flex items-center gap-2 pt-4">
                                <Switch
                                    id="only-issuable"
                                    checked={d.filters.onlyIssuable}
                                    onCheckedChange={(onlyIssuable) => d.changeFilters({ onlyIssuable })}
                                />
                                <Label htmlFor="only-issuable" className="text-sm">Только кому можно выдать код</Label>
                            </div>
                        </>
                    ),
                },
            }}
        >
            {d.demo && (
                <div className="mb-4 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                    Демо-режим: выдать код можно всем. Студентам без учётки AD или не обучающимся выдаётся демо-код — он только на листе, войти по нему нельзя.
                </div>
            )}
            <CommonControlState isError={d.students.error} isLoading={d.students.loading} isEmpty={d.filtered.length === 0}>
                <div className="flex flex-col gap-4">
                    {shown.map((g) => (
                        <DeaneryGroupCard
                            key={g.group}
                            group={g}
                            selected={d.selected}
                            canIssue={canIssue}
                            busy={issuer.sending}
                            onToggle={d.toggle}
                            onIssueGroup={setConfirm}
                        />
                    ))}
                    {d.grouped.length > GROUPS_SHOWN && (
                        <p className="text-sm text-muted-foreground">
                            Показаны {GROUPS_SHOWN} групп из {d.grouped.length}. Выберите курс или группу, либо уточните поиск.
                        </p>
                    )}
                </div>
            </CommonControlState>

            <ConfirmIssueDialog students={confirm} sending={issuer.sending} onClose={() => setConfirm(null)} onConfirm={issue} />
            <IssuedDialog
                codes={issuer.codes}
                onPrint={() => issuer.codes && printActivationSheet(issuer.codes, faculty)}
                onClose={issuer.reset}
            />
        </CommonWrapper>
    );
}
