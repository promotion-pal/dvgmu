import { z } from "zod";

export const studentSchema = z.object({
    userId: z.string().trim().min(1, "Выберите пользователя"),
    group: z.string().trim().min(1, "Группа обязательна для заполнения"),
    recordBook: z.string().trim().optional(),
    status: z.coerce.number().optional(),
    educationForm: z.coerce.number().optional(),
    needsDormitory: z.boolean().optional(),
});
export type StudentSchema = z.infer<typeof studentSchema>;
