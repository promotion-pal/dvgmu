import { z } from "zod";

export const mentorCourseSchema = z
  .object({
    startDate: z.string().min(1, "Укажите дату начала курса"),
    endDate: z.string().min(1, "Укажите дату окончания курса"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Дата окончания не может быть раньше даты начала",
    path: ["endDate"],
  });

export type MentorCourseSchema = z.infer<typeof mentorCourseSchema>;
