import { z } from "zod";

export const courseQuestionSchema = z.object({
  name: z.string().min(2, "Имя должно быть не менее 2 символов"),
  email: z.string().min(1, "Введите почту").email("Введите корректную почту"),
  question: z.string().min(10, "Опишите ваш вопрос подробнее"),
});

export type CourseQuestionSchema = z.infer<typeof courseQuestionSchema>;
