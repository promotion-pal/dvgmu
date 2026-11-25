import { z } from "zod";

export interface VaccinationSignup {
    id: string;
    fullName: string;
}

export interface VaccinationSlot {
    id: string;
    timeStart: string;
    timeEnd: string;
    capacity: number;
    signups: VaccinationSignup[];
}

export interface VaccinationDay {
    id: string;
    date: string;
    title: string;
    place?: string;
    note?: string;
    slots: VaccinationSlot[];
}

/** The public sign-up form: who, and their consent to the name being published. */
export const vaccinationSignupSchema = z.object({
    fullName: z
        .string()
        .trim()
        .min(5, "Укажите фамилию, имя и отчество")
        .refine((value) => value.split(/\s+/).length >= 2, "Укажите фамилию, имя и отчество"),
    consent: z.boolean().refine((value) => value, "Нужно согласие на обработку и публикацию ФИО"),
});
export type VaccinationSignupForm = z.infer<typeof vaccinationSignupSchema>;

/** Staff: a new vaccination day (it gets the standard slots). */
export const vaccinationDaySchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД"),
    title: z.string().trim().min(1, "Укажите название"),
    place: z.string().trim(),
    note: z.string().trim(),
});
export type VaccinationDayForm = z.infer<typeof vaccinationDaySchema>;

/** Which day is open; lives in the URL (see vaccination.url.ts). */
export interface VaccinationFilters {
    dayId?: string;
}
export const EMPTY_VACCINATION_FILTERS: VaccinationFilters = {};
