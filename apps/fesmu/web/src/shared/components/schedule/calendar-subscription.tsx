import { useEffect, useState } from "react";
import { CalendarPlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { CommonShareLink } from "@/shared/components/share";

export function CalendarSubscription({ timetable, group, title }: { timetable?: string; group?: string; title: string }) {
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState("");
    const scope = timetable ? "/timetable/" + encodeURIComponent(timetable) : "";
    const audience = group ? "/group/" + encodeURIComponent(group) : "";
    const path = "/calendar" + scope + audience + "/schedule.ics";
    const url = new URL(path, window.location.origin);
    const href = url.href;
    const subscriptionHref = href.replace(/^https?:/, "webcal:");
    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        fetch(path, { method: "HEAD", signal: controller.signal, cache: "no-cache" })
            .then(response => {
                const count = response.headers.get("X-Calendar-Events");
                if (!response.ok || count === null) throw new Error();
                setStatus("Занятий в подписке: " + count);
            }).catch(() => {
                if (!controller.signal.aborted) setStatus("Не удалось загрузить расписание для подписки.");
            });
        return () => controller.abort();
    }, [open, path]);
    return (
        <Dialog open={open} onOpenChange={value => { setStatus(""); setOpen(value); }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm"><CalendarPlusIcon />Подписаться на календарь</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Подписка на расписание</DialogTitle>
                    <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <p role="status" className="text-sm">{status || "Проверяем расписание…"}</p>
                <Button asChild>
                    <a href={subscriptionHref}><CalendarPlusIcon />Подписаться</a>
                </Button>
                <p className="text-sm text-muted-foreground">Скопируйте ссылку и вставьте её в поле подписки в календаре.</p>
                <CommonShareLink url={href} label="Скопировать ссылку" />
            </DialogContent>
        </Dialog>
    );
}
