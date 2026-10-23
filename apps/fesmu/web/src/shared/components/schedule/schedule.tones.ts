import type { SchedulePeriodTone, ScheduleTone } from "./schedule.types";

/** Full class strings on purpose: Tailwind only generates classes it can see verbatim. */
export const LESSON_TONE_STYLES: Record<ScheduleTone, { card: string; accent: string; pill: string }> = {
    rose: { card: "bg-rose-50 text-rose-950 border-rose-200", accent: "bg-rose-500", pill: "bg-rose-100 text-rose-800" },
    sky: { card: "bg-sky-50 text-sky-950 border-sky-200", accent: "bg-sky-500", pill: "bg-sky-100 text-sky-800" },
    emerald: { card: "bg-emerald-50 text-emerald-950 border-emerald-200", accent: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-800" },
    amber: { card: "bg-amber-50 text-amber-950 border-amber-200", accent: "bg-amber-500", pill: "bg-amber-100 text-amber-800" },
    violet: { card: "bg-violet-50 text-violet-950 border-violet-200", accent: "bg-violet-500", pill: "bg-violet-100 text-violet-800" },
    teal: { card: "bg-teal-50 text-teal-950 border-teal-200", accent: "bg-teal-500", pill: "bg-teal-100 text-teal-800" },
    orange: { card: "bg-orange-50 text-orange-950 border-orange-200", accent: "bg-orange-500", pill: "bg-orange-100 text-orange-800" },
    indigo: { card: "bg-indigo-50 text-indigo-950 border-indigo-200", accent: "bg-indigo-500", pill: "bg-indigo-100 text-indigo-800" },
    pink: { card: "bg-pink-50 text-pink-950 border-pink-200", accent: "bg-pink-500", pill: "bg-pink-100 text-pink-800" },
    cyan: { card: "bg-cyan-50 text-cyan-950 border-cyan-200", accent: "bg-cyan-500", pill: "bg-cyan-100 text-cyan-800" },
    lime: { card: "bg-lime-50 text-lime-950 border-lime-200", accent: "bg-lime-500", pill: "bg-lime-100 text-lime-800" },
    slate: { card: "bg-slate-50 text-slate-900 border-slate-200", accent: "bg-slate-500", pill: "bg-slate-100 text-slate-700" },
};

export const PERIOD_TONE_STYLES: Record<SchedulePeriodTone, { chip: string; dot: string }> = {
    study: { chip: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500" },
    practice: { chip: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-500" },
    session: { chip: "border-amber-200 bg-amber-50 text-amber-900", dot: "bg-amber-500" },
    holiday: { chip: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400" },
};
