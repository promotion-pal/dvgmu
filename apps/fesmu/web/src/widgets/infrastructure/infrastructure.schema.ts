import { z } from "zod";

export const infrastructureSchema = z.object({
    title: z.string().trim().min(1, "Название обязательно для заполнения"),
    description: z.string().trim().optional(),
    floor: z.coerce.number({ error: "Этаж обязателен для заполнения" }),
    room: z.coerce.number({ error: "Кабинет обязателен для заполнения" }),
    location: z.coerce.number().optional(),
});
export type InfrastructureSchema = z.infer<typeof infrastructureSchema>;
