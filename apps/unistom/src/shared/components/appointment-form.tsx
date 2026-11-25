'use client'

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const doctorOptions = [
  "Стоматолог-терапевт",
  "Стоматолог-ортопед",
  "Стоматолог-хирург",
  "Врач-ортодонт",
  "Пародонтолог",
  "Детский стоматолог",
  "Консультация профессора",
];

const paymentOptions = ["ОМС", "ДМС", "Платно"];

const field =
  "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function AppointmentForm() {
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Заявка отправлена</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Если вы записались на приём на сайте, в течение 3 рабочих дней вам
          перезвонит оператор регистратуры для подтверждения даты и времени.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-sm font-medium text-primary"
        >
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2"
    >
      <label className="text-sm sm:col-span-2">
        Ф. И. О. <span className="text-primary">*</span>
        <input required name="name" className={field} autoComplete="name" />
      </label>

      <label className="text-sm">
        Дата рождения <span className="text-primary">*</span>
        <input required type="date" name="birthdate" className={field} />
      </label>
      <label className="text-sm">
        Район прописки
        <input name="district" className={field} />
      </label>

      <label className="text-sm">
        Социальное положение
        <input
          name="social"
          placeholder="работающий, пенсионер, студент…"
          className={field}
        />
      </label>
      <label className="text-sm">
        Форма расчёта <span className="text-primary">*</span>
        <select required name="payment" defaultValue="" className={field}>
          <option value="" disabled>
            Выберите
          </option>
          {paymentOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        Врач <span className="text-primary">*</span>
        <select required name="doctor" defaultValue="" className={field}>
          <option value="" disabled>
            Выберите специалиста
          </option>
          {doctorOptions.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Желаемая дата
          <input type="date" name="date" className={field} />
        </label>
        <label className="text-sm">
          Время
          <input type="time" name="time" className={field} />
        </label>
      </div>

      <label className="text-sm">
        Телефон для связи <span className="text-primary">*</span>
        <input
          required
          type="tel"
          name="phone"
          className={field}
          autoComplete="tel"
        />
      </label>
      <label className="text-sm">
        Электронная почта
        <input type="email" name="email" className={field} autoComplete="email" />
      </label>

      <label className="text-sm sm:col-span-2">
        Дополнительная информация
        <textarea name="notes" rows={3} className={cn(field, "resize-y")} />
      </label>

      <p className="text-xs text-muted-foreground sm:col-span-2">
        Нажимая «Отправить», вы соглашаетесь на обработку персональных данных в
        целях записи на приём.
      </p>

      <button
        type="submit"
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 sm:col-span-2 sm:justify-self-start"
      >
        Отправить заявку
      </button>
    </form>
  );
}
