import { z } from "zod";

export const userSchema = z.object({
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
    .regex(/^\+?[0-9\s()-]{10,18}$/, "Введите корректный номер телефона"),
});

export type UserCreateSchema = z.infer<typeof userSchema>;
