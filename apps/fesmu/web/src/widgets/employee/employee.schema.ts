import { z } from "zod";

export const employeeSchema = z.object({
    userId: z.string().trim().min(1, "Выберите пользователя"),
    department: z.coerce.number().optional(),
});
export type EmployeeSchema = z.infer<typeof employeeSchema>;
