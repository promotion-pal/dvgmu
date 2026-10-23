import type { FC } from "react";
import { CalendarDaysIcon, ClockIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { LESSON_TONE_STYLES } from "./schedule.tones";
import type { ScheduleLessonView } from "./schedule.types";

interface ScheduleLessonCardProps {
    lesson: ScheduleLessonView;
    /** Tighter spacing for grid cells. */
    compact?: boolean;
    className?: string;
}

const ScheduleLessonCard: FC<ScheduleLessonCardProps> = ({ lesson, compact = false, className }) => {
    const tone = LESSON_TONE_STYLES[lesson.tone];

    return (
        <div
            className={cn(
                "relative flex flex-col gap-1 overflow-hidden rounded-lg border pl-3 pr-2 text-left",
                compact ? "py-1.5 text-xs" : "py-2 text-sm",
                tone.card,
                className,
            )}
        >
            <span className={cn("absolute inset-y-0 left-0 w-1", tone.accent)} aria-hidden />

            <p className="font-semibold leading-snug">{lesson.title}</p>

            {(lesson.time || lesson.meta) && (
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.7rem] leading-tight opacity-80">
                    {lesson.time && (
                        <span className="inline-flex items-center gap-1 font-medium">
                            <ClockIcon className="size-3" />
                            {lesson.time}
                        </span>
                    )}
                    {lesson.meta && <span>{lesson.meta}</span>}
                </p>
            )}

            {lesson.badges && lesson.badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {lesson.badges.map((badge) => (
                        <span key={badge} className={cn("rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium leading-none", tone.pill)}>
                            {badge}
                        </span>
                    ))}
                </div>
            )}

            {lesson.dates && (
                <p className="flex items-start gap-1 text-[0.7rem] leading-snug opacity-90">
                    <CalendarDaysIcon className="mt-0.5 size-3 shrink-0" />
                    <span>{lesson.dates}</span>
                </p>
            )}

            {lesson.location && (
                <p className="flex items-start gap-1 text-[0.7rem] leading-snug opacity-80">
                    <MapPinIcon className="mt-0.5 size-3 shrink-0" />
                    <span>{lesson.location}</span>
                </p>
            )}

            {lesson.audience && (
                <p className="flex items-center gap-1 text-[0.7rem] leading-snug opacity-80">
                    <UsersIcon className="size-3 shrink-0" />
                    <span>{lesson.audience}</span>
                </p>
            )}
        </div>
    );
};

export { ScheduleLessonCard };
