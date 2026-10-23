import { z } from "zod";

export const mentorQuestionSchema = z.object({
  lastName: z.string().min(2, "Фамилия должна быть не менее 2 символов"),
  firstName: z.string().min(2, "Имя должно быть не менее 2 символов"),
  patronymic: z.string().optional(),
  email: z.string().min(1, "Введите email").email("Введите корректный email"),
  question: z.string().min(5, "Опишите ваш вопрос"),
  consent: z.boolean().refine((value) => value === true, {
    message: "Необходимо согласие на обработку персональных данных",
  }),
});

export type MentorQuestionSchema = z.infer<typeof mentorQuestionSchema>;
