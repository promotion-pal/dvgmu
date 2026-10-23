import type { ManualCard, ManualStatus } from "@/features/library";

export const STATUS_LABEL: Record<ManualStatus, string> = {
    draft: "Черновик",
    published: "Опубликована",
    archived: "Снята с публикации",
};

/** Курс, семестр, специальность одной строкой. */
export const manualMeta = (m: ManualCard) =>
    [m.specialty, m.course ? `${m.course} курс` : "", m.semester ? `${m.semester} семестр` : ""].filter(Boolean).join(" · ");
