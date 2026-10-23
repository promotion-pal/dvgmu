import { z } from "zod";

/** The exchange format's Day column: 1 = Monday .. 7 = Sunday. */
export const DAY_OPTIONS = [
    { value: 1, label: "Понедельник" },
    { value: 2, label: "Вторник" },
    { value: 3, label: "Среда" },
    { value: 4, label: "Четверг" },
    { value: 5, label: "Пятница" },
    { value: 6, label: "Суббота" },
    { value: 7, label: "Воскресенье" },
];

/** The exchange format's Subj_type column is free text in the source spec
 * (л.-лекционное, пр.-практическое, …); the collector narrows it to a
 * dropdown of the values actually in use. */
export const SUBJ_TYPE_OPTIONS = [
    { value: "л.", label: "Лекция (л.)" },
    { value: "пр.", label: "Практическое (пр.)" },
    { value: "лаб.", label: "Лабораторное (лаб.)" },
    { value: "сем.", label: "Семинар (сем.)" },
    { value: "конс.", label: "Консультация (конс.)" },
    { value: "зач.", label: "Зачёт (зач.)" },
    { value: "экз.", label: "Экзамен (экз.)" },
];

const requiredText = (message: string) => z.string().trim().min(1, message);

/** One row of the exchange format the teacher fills in, plus the
 * Substitution_* columns used when a substitute covers the lesson.
 *
 * The format also has Group, StudInLesson, Week, Subg, PrepID, CafID and
 * Subj_CafID (and the matching Substitution_PrepID/Substitution_Subj_CafID)
 * — technical/administrative codes a teacher won't have on hand — which
 * aren't collected here; see schedule-collect.api.ts for how they're filled
 * in when the row is sent. Day isn't collected either — it's derived from
 * Date there, so there's nothing to keep in sync by hand. Name and
 * Substitution_Name (position + full name in one column) are split into a
 * position field and last/first/middle name fields, joined back into one on
 * submit. */
export const scheduleCollectEntrySchema = z
    .object({
        les: z.coerce.number({ message: "Укажите номер занятия" }).int().min(1, "Номер занятия должен быть не меньше 1"),
        aud: requiredText("Укажите аудиторию"),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату занятия"),

        namePosition: requiredText("Укажите должность преподавателя"),
        nameLastName: requiredText("Укажите фамилию преподавателя"),
        nameFirstName: requiredText("Укажите имя преподавателя"),
        nameMiddleName: z.string().trim().optional().default(""),
        subject: requiredText("Укажите наименование дисциплины"),
        subjType: requiredText("Выберите вид занятия"),
        themas: z.string().trim().optional().default(""),

        substitutionPosition: z.string().trim().optional().default(""),
        substitutionLastName: z.string().trim().optional().default(""),
        substitutionFirstName: z.string().trim().optional().default(""),
        substitutionMiddleName: z.string().trim().optional().default(""),
        substitutionSubject: z.string().trim().optional().default(""),
        substitutionSubjType: z.string().trim().optional().default(""),
        substitutionThemas: z.string().trim().optional().default(""),
    })
    // Mirrors the server's rule: the substitution columns describe one event
    // together — either none of them are filled in, or the ones that identify
    // the substitute and what they teach are.
    .superRefine((values, ctx) => {
        const hasSubstitution = [
            values.substitutionPosition,
            values.substitutionLastName,
            values.substitutionFirstName,
            values.substitutionMiddleName,
            values.substitutionSubject,
            values.substitutionSubjType,
            values.substitutionThemas,
        ].some((value) => value.trim() !== "");
        if (!hasSubstitution) return;

        if (values.substitutionPosition.trim() === "")
            ctx.addIssue({ code: "custom", path: ["substitutionPosition"], message: "Укажите должность заменяющего преподавателя" });
        if (values.substitutionLastName.trim() === "")
            ctx.addIssue({ code: "custom", path: ["substitutionLastName"], message: "Укажите фамилию заменяющего преподавателя" });
        if (values.substitutionFirstName.trim() === "")
            ctx.addIssue({ code: "custom", path: ["substitutionFirstName"], message: "Укажите имя заменяющего преподавателя" });
        if (values.substitutionSubject.trim() === "")
            ctx.addIssue({ code: "custom", path: ["substitutionSubject"], message: "Укажите наименование дисциплины замены" });
        if (values.substitutionSubjType.trim() === "")
            ctx.addIssue({ code: "custom", path: ["substitutionSubjType"], message: "Выберите вид занятия замены" });
    });

export type ScheduleCollectEntryInput = z.infer<typeof scheduleCollectEntrySchema>;

/** A submitted row, as echoed back by the server: the full exchange format,
 * including the columns the collector doesn't ask for (sent as empty/zero). */
export interface ScheduleCollectEntry {
    id: string;
    group: string;
    studInLesson: number;
    day: number;
    les: number;
    aud: string;
    week: number;
    subg: number;
    name: string;
    cafId: string;
    subject: string;
    subjType: string;
    date: string;
    subjCafId: string;
    prepId: string;
    themas: string;
    substitutionName: string;
    substitutionPrepId: string;
    substitutionSubject: string;
    substitutionSubjType: string;
    substitutionSubjCafId: string;
    substitutionThemas: string;
    createdAt: string;
}

export const EMPTY_SCHEDULE_COLLECT_ENTRY: ScheduleCollectEntryInput = {
    les: 1,
    aud: "",
    date: "",
    namePosition: "",
    nameLastName: "",
    nameFirstName: "",
    nameMiddleName: "",
    subject: "",
    subjType: "",
    themas: "",
    substitutionPosition: "",
    substitutionLastName: "",
    substitutionFirstName: "",
    substitutionMiddleName: "",
    substitutionSubject: "",
    substitutionSubjType: "",
    substitutionThemas: "",
};
