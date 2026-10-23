import { AnalyticType } from "@dvgmu/contract/packages/analytics/enum/analytic.enum_pb";
import z from "zod";

export const analyticSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно для заполнения"),
  // Пусто — номер подберёт модуль «Опросы» (следующий свободный).
  qr: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().int("Номер QR — целое число").positive("Номер QR должен быть положительным").optional(),
  ),
  type: z.preprocess(
    (v) => (v !== "" && v !== undefined ? Number(v) : v),
    z.nativeEnum(AnalyticType, {
      error: () => ({ message: "Выберите корректную категорию" }),
    }),
  ),
  // Короткое название для отчётов; длинное плохо читается на карточках и графиках.
  transcript: z.string().trim().max(40, "Не длиннее 40 символов — это короткая подпись").optional(),
});
export type AnalyticSchema = z.infer<typeof analyticSchema>;
