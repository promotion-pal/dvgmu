import { useCallback, useEffect, useState } from "react";
import { CalendarPlusIcon, CheckIcon, XIcon } from "lucide-react";
import { FormProvider } from "react-hook-form";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState } from "@/shared/components/state/control-state";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { useUserProvider } from "@/features/provider/user.provider";
import { PermissionAction, PermissionSection, permsFor } from "@/shared/config/permissions";
import { HallBookingFields, HallBookingModal, HallScheduleCalendar, HallScheduleToolbar, useScheduleHall } from "@/widgets/schedule/schedule_hall";
import { hallApi } from "@/widgets/schedule/schedule_hall/schedule_hall.api";
import type { HallEvent } from "@/widgets/schedule/schedule_hall/schedule_hall.schema";

const fullName = (first = "", last = "") => [first, last].filter(Boolean).join(" ");

export default function ScheduleHallPage() {
    const hasPermission = useUserProvider((s) => s.hasPermission);
    const profile = useUserProvider((s) => s.profile);
    const isReviewer = hasPermission(...permsFor(PermissionSection.HALLS));
    const canReview = hasPermission(...permsFor(PermissionSection.HALLS, PermissionAction.POST));
    const [myRequests, setMyRequests] = useState<HallEvent[]>([]);
    const fetchMine = useCallback(async () => {
        if (isReviewer) return;
        try { setMyRequests(await hallApi.fetchMine()); } catch (error) { console.error("Не удалось загрузить мои заявки:", error); }
    }, [isReviewer]);
    const scheduleHall = useScheduleHall({ viewer: isReviewer ? "staff" : "public", onBooked: fetchMine });

    useEffect(() => {
        void scheduleHall.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isReviewer]);

    useEffect(() => {
        if (isReviewer) return;
        void hallApi.fetchMine().then(setMyRequests).catch((error) => console.error("Не удалось загрузить мои заявки:", error));
    }, [isReviewer]);

    useEffect(() => {
        if (!profile) return;
        scheduleHall.bookingForm.form.setValue("organizer", fullName(profile.firstName, profile.lastName), { shouldValidate: true });
        scheduleHall.bookingForm.form.setValue("contact", profile.email, { shouldValidate: true });
    }, [profile, scheduleHall.bookingForm.form]);

    const decide = async (event: HallEvent, status: "approved" | "rejected") => {
        const reason = status === "rejected" ? window.prompt("Укажите причину отказа")?.trim() : "";
        if (status === "rejected" && !reason) return;
        try {
            await hallApi.updateStatus(event.id, status, reason);
            await scheduleHall.fetch();
        } catch {
            window.alert("Не удалось изменить статус заявки");
        }
    };

    const pending = scheduleHall.events.filter((event) => event.status === "pending");

    return (
        <CommonWrapper
            title="Лекционные залы"
            description={isReviewer ? "Расписание залов и заявки на проверку" : "Подайте заявку на использование лекционного зала"}
            action={isReviewer ? (
                <Button type="button" size="sm" onClick={scheduleHall.openBooking}>
                    <CalendarPlusIcon className="size-4" />
                    Подать заявку
                </Button>
            ) : undefined}
        >
            {isReviewer ? (
                <CommonControlState isLoading={scheduleHall.loading} isError={scheduleHall.error} isEmpty={scheduleHall.empty}>
                    <div className="flex flex-col gap-6">
                        <section className="flex flex-col gap-4">
                            <h2 className="text-lg font-semibold">Общее расписание</h2>
                            <HallScheduleToolbar monthTitle={scheduleHall.monthTitle} isCurrentMonth={scheduleHall.isCurrentMonth} onPrev={scheduleHall.goPrevMonth} onNext={scheduleHall.goNextMonth} onToday={scheduleHall.goToday} hallOptions={scheduleHall.hallOptions} hallId={scheduleHall.filters.hallId} onChangeHall={scheduleHall.changeHall} />
                            <HallScheduleCalendar weeks={scheduleHall.weeks} onRemove={canReview ? scheduleHall.removeBooking : undefined} />
                        </section>
                        <section className="flex flex-col gap-3">
                            <h2 className="text-lg font-semibold">Заявки на проверку ({pending.length})</h2>
                            {!canReview && <p className="text-sm text-muted-foreground">Заявки доступны для просмотра. Для одобрения и отклонения нужен доступ «Правка и модерация» в разделе «Администрирование → Доступы».</p>}
                            {pending.length === 0 ? <p className="text-sm text-muted-foreground">Новых заявок нет.</p> : pending.map((request) => (
                                <RequestCard key={request.id} request={request} hallName={scheduleHall.halls.find((hall) => hall.id === request.hallId)?.name ?? "Зал"} onDecision={decide} canReview={canReview} />
                            ))}
                        </section>
                    </div>
                </CommonControlState>
            ) : (
                <CommonControlState isLoading={scheduleHall.loading} isError={scheduleHall.error} isEmpty={scheduleHall.empty}>
                    <Card>
                        <CardHeader><CardTitle>Заявка на бронирование</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <FormProvider {...scheduleHall.bookingForm.form}>
                                <form onSubmit={scheduleHall.bookingForm.handleSubmit} className="flex flex-col gap-4">
                                    <HallBookingFields hallOptions={scheduleHall.hallOptions} readOnlyApplicant />
                                    <Button type="submit" className="w-fit" disabled={scheduleHall.bookingForm.form.formState.isSubmitting}>Отправить на проверку</Button>
                                </form>
                            </FormProvider>
                            <section className="space-y-3">
                                <h2 className="text-lg font-semibold">Мои заявки</h2>
                                {myRequests.length === 0 ? <p className="text-sm text-muted-foreground">Отправленных заявок пока нет.</p> : myRequests.map((request) => (
                                    <Card key={request.id}><CardContent className="space-y-1 pt-4 text-sm">
                                        <p className="font-medium">{request.date} · {request.timeStart}–{request.timeEnd} · {scheduleHall.halls.find((hall) => hall.id === request.hallId)?.name ?? "Зал"}</p>
                                        <p>{request.title}</p>
                                        <Badge variant={request.status === "approved" ? "default" : request.status === "rejected" ? "destructive" : "secondary"}>{statusLabel(request.status)}</Badge>
                                        {request.reviewComment && <p className="text-muted-foreground">Комментарий: {request.reviewComment}</p>}
                                    </CardContent></Card>
                                ))}
                            </section>
                        </CardContent>
                    </Card>
                </CommonControlState>
            )}
            <HallBookingModal modal={scheduleHall.bookingModal} bookingForm={scheduleHall.bookingForm} hallOptions={scheduleHall.hallOptions} readOnlyApplicant={!isReviewer} />
        </CommonWrapper>
    );
}

const statusLabel = (status: HallEvent["status"]) => ({ pending: "На проверке", approved: "Одобрена", rejected: "Отклонена", cancelled: "Отменена" })[status];

function RequestCard({ request, hallName, onDecision, canReview }: { request: HallEvent; hallName: string; onDecision: (request: HallEvent, status: "approved" | "rejected") => void; canReview: boolean }) {
    return <Card><CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1 text-sm">
            <p className="font-medium">{request.date} · {request.timeStart}–{request.timeEnd} · {hallName}</p>
            <p>{request.title}</p>
            <p className="text-muted-foreground">Заявитель: {request.organizer || "не указан"}{request.contact ? ` · ${request.contact}` : ""}</p>
            <Badge variant="secondary">На проверке</Badge>
        </div>
        {canReview && <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => onDecision(request, "approved")}><CheckIcon className="size-4" />Одобрить</Button>
            <Button size="sm" variant="destructive" onClick={() => onDecision(request, "rejected")}><XIcon className="size-4" />Отклонить</Button>
        </div>}
    </CardContent></Card>;
}
