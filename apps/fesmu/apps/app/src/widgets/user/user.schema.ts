import { z } from "zod";

export const userSchema = z.object({
    lastName: z.string().trim().min(1, "Фамилия обязательна для заполнения"),
    firstName: z.string().trim().min(1, "Имя обязательно для заполнения"),
    patronymic: z.string().trim().optional(),
    email: z.string().trim().email("Некорректный email"),
    phone: z.string().trim().optional(),
    birthday: z.string().optional(),
});
export type UserSchema = z.infer<typeof userSchema>;
