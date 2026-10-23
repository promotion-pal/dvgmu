import { z } from "zod";

export const userImportSchema = z.object({
    file: z.instanceof(File, { message: "Выберите файл" }),
});
export type UserImportSchema = z.infer<typeof userImportSchema>;
