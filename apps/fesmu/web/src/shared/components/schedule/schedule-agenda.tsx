import type { FC } from "react";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { ScheduleLessonCard } from "./schedule-lesson";
import type { ScheduleAgendaSection } from "./schedule.types";

interface ScheduleAgendaProps {
    sections: ScheduleAgendaSection[];
}

/** The same schedule as a per-day list, in time order — reads well on a phone
 * and when one group's week is what matters. */
const ScheduleAgenda: FC<ScheduleAgendaProps> = ({ sections }) => {
    return (
        <div className={cn("grid gap-4", sections.length === 1 ? "max-w-2xl" : "md:grid-cols-2 xl:grid-cols-3")}>
            {sections.map((section) => (
                <Card key={section.id} className="gap-0 overflow-hidden p-0">
                    <div className="flex items-baseline justify-between gap-3 border-b bg-muted/40 px-4 py-2.5">
                        <h3 className="text-sm font-semibold">{section.title}</h3>
                        {section.subtitle && <span className="text-xs text-muted-foreground">{section.subtitle}</span>}
                    </div>

                    <ol className="flex flex-col gap-2 p-3">
                        {section.items.map((item) => (
                            <li key={item.id} className="grid grid-cols-[4.5rem_1fr] items-start gap-2">
                                <span className="pt-2 font-mono text-[0.7rem] leading-tight text-muted-foreground">{item.time}</span>
                                <div className="flex flex-col gap-2">
                                    {item.lessons.map((lesson) => (
                                        <ScheduleLessonCard key={lesson.id} lesson={{ ...lesson, time: undefined }} />
                                    ))}
                                </div>
                            </li>
                        ))}
                    </ol>
                </Card>
            ))}
        </div>
    );
};

export { ScheduleAgenda };
