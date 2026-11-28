import { useState } from "react";
import { CalendarPlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { CommonShareLink } from "@/shared/components/share";

export function CalendarSubscription({ timetable, group, title }: { timetable?: string; group?: string; title: string }) {
    const [open, setOpen] = useState(false);
    const scope = timetable ? "/timetable/" + encodeURIComponent(timetable) : "";
    const audience = group ? "/group/" + encodeURIComponent(group) : "";
    const path = "/calendar" + scope + audience + "/schedule.ics";
    const url = new URL(path, window.location.origin);
    const href = url.href;
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm"><CalendarPlusIcon />Подписаться на календарь</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Подписка на расписание</DialogTitle>
                    <DialogDescription>{title}</DialogDescription>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Скопируйте ссылку и вставьте её в поле подписки в календаре.</p>
                <CommonShareLink url={href} label="Скопировать ссылку" />
            </DialogContent>
        </Dialog>
    );
}
