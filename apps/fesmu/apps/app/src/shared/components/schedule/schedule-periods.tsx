import type { FC } from "react";
import { cn } from "@/shared/lib/utils";
import { PERIOD_TONE_STYLES } from "./schedule.tones";
import type { SchedulePeriodView } from "./schedule.types";

interface SchedulePeriodsProps {
    periods: SchedulePeriodView[];
}

/** The calendar of a term at a glance: study, practice, exams, breaks. */
const SchedulePeriods: FC<SchedulePeriodsProps> = ({ periods }) => {
    return (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {periods.map((period) => {
                const tone = PERIOD_TONE_STYLES[period.tone];
                return (
                    <li
                        key={period.id}
                        className={cn(
                            "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-sm",
                            tone.chip,
                            period.active && "ring-2 ring-offset-1 ring-current",
                        )}
                    >
                        <span className="flex items-center gap-2 font-medium">
                            <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden />
                            {period.label}
                            {period.active && <span className="ml-auto text-[0.65rem] font-semibold uppercase tracking-wide">сейчас</span>}
                        </span>
                        <span className="text-xs opacity-80">{period.range}</span>
                    </li>
                );
            })}
        </ul>
    );
};

export { SchedulePeriods };
