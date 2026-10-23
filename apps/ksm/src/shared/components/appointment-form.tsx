'use client'

import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { PromFieldInput, PromFieldTextArea } from "@/features/lib/form/text/prom.form.text";
import { PromFieldSelect } from "@/features/lib/form/select/prom.form.select";
import { PromDateField } from "@/features/lib/form/date/prom.form.date";

const doctorOptions = [
  "Гастроэнтеролог",
  "Гинеколог",
  "Гинеколог-эндокринолог",
  "Дерматолог",
  "Детский кардиолог",
  "Иммунолог-аллерголог",
  "Кардиолог",
  "ЛОР (оториноларинголог)",
  "Невролог (взрослый)",
  "Невролог (детский)",
  "Онколог-маммолог",
  "Ортопед (детский)",
  "Ортопед",
  "Педиатр",
  "Пульмонолог",
  "Терапевт",
  "Семейный врач",
  "Уролог",
  "УЗИ",
  "Хирург",
  "Хирург сердечно-сосудистый",
  "Эндокринолог",
];

const schema = z.object({
  fio: z.string().min(3, "Укажите фамилию, имя и отчество"),
  birthdate: z.string().min(1, "Укажите дату рождения"),
  doctor: z.string().min(1, "Выберите специалиста"),
  desiredDate: z.string().optional(),
  desiredTime: z.string().min(1, "Укажите желаемое время"),
  phone: z
    .string()
    .min(6, "Укажите телефон для связи")
    .regex(/[\d()+\-\s]{6,}/, "Проверьте номер телефона"),
  email: z.union([z.literal(""), z.string().email("Проверьте адрес электронной почты")]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function AppointmentForm() {
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState(false);

  const methods = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fio: "",
      birthdate: "",
      doctor: "",
      desiredDate: "",
      desiredTime: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  if (sent) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">Заявка отправлена</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Уважаемый пациент! Если вы записались на приём на нашем сайте, на ваш
          мобильный телефон в течение 12 часов перезвонит оператор регистратуры
          для подтверждения даты и времени приёма.
        </p>
        <button
          type="button"
          onClick={() => {
            methods.reset();
            setConsent(false);
            setSent(false);
          }}
          className="mt-4 text-sm font-medium text-primary"
        >
          Отправить ещё одну заявку
        </button>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(() => setSent(true))}
        className="grid grid-cols-1 gap-5 rounded-xl border border-border bg-card p-6 shadow-sm sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <PromFieldInput<FormValues>
            name="fio"
            label="Ф. И. О. *"
            placeholder="Иванов Иван Иванович"
          />
        </div>

        <PromDateField<FormValues> name="birthdate" label="Дата рождения" />
        <PromFieldSelect<FormValues>
          name="doctor"
          label="Врач *"
          options={doctorOptions.map((d) => ({ value: d, label: d }))}
          placeholder="Выберите специалиста"
        />

        <PromDateField<FormValues>
          name="desiredDate"
          label="Желаемая дата"
          required={false}
        />
        <PromFieldInput<FormValues>
          name="desiredTime"
          label="Желаемое время *"
          placeholder="например, 10:00"
        />

        <PromFieldInput<FormValues>
          name="phone"
          type="tel"
          label="Телефон для связи *"
          placeholder="+7 (___) ___-__-__"
        />
        <PromFieldInput<FormValues>
          name="email"
          type="email"
          label="Электронная почта"
          placeholder="name@example.com"
        />

        <div className="sm:col-span-2">
          <PromFieldTextArea<FormValues>
            name="notes"
            label="Дополнительная информация"
            rows={3}
          />
        </div>

        <label className="flex items-start gap-2 text-xs text-muted-foreground sm:col-span-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            Нажимая «Отправить», я даю согласие на обработку персональных данных
            в целях записи на приём.
          </span>
        </label>

        <button
          type="submit"
          disabled={!consent}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
        >
          Отправить заявку
        </button>
      </form>
    </FormProvider>
  );
}
