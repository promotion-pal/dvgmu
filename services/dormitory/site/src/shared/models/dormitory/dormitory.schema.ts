import { z } from "zod";

import { GROUP_REGEX, RECORD_BOOK_REGEX } from "@/shared/lib/record-book";

export const dutyRegistrationSchema = z.object({
  lastName: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(64, "Максимум 64 символа"),
  firstName: z
    .string()
    .trim()
    .min(2, "Минимум 2 символа")
    .max(64, "Максимум 64 символа"),
  patronymic: z
    .string()
    .trim()
    .max(64, "Максимум 64 символа")
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+7\d{10}$/, "Телефон в формате +7XXXXXXXXXX"),
  recordBook: z
    .string()
    .trim()
    .regex(RECORD_BOOK_REGEX, "Номер зачётки — 7 цифр"),
  group: z
    .string()
    .trim()
    .regex(GROUP_REGEX, "Номер группы — 3–4 цифры"),
  room: z
    .string()
    .trim()
    .regex(/^\d{3,4}$/, "Номер комнаты — 3–4 цифры"),
  data: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату дежурства"),
  consent: z.boolean().refine((v) => v === true, {
    message: "Нужно согласие на обработку персональных данных",
  }),
});

export type DutyRegistrationSchema = z.infer<typeof dutyRegistrationSchema>;

// Форма админа: те же поля студента, но без согласия (записывает админ).
export const adminRegistrationSchema = dutyRegistrationSchema.omit({
  consent: true,
});

export type AdminRegistrationSchema = z.infer<typeof adminRegistrationSchema>;
