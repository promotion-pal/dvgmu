import type { Metadata } from "next";
import { Clock, Phone } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";
import { AppointmentForm } from "@/shared/components/appointment-form";

export const metadata: Metadata = {
  title: "Запись на приём",
  description:
    "Онлайн-заявка на приём к врачу «Клиники семейной медицины» ДВГМУ. Заполните форму — оператор регистратуры перезвонит для подтверждения.",
};

export default function AppointmentPage() {
  return (
    <>
      <PageHeader
        title="Запись на приём к врачу"
        intro="Заполните заявку, чтобы записаться к врачу на приём. Поля, отмеченные звёздочкой, обязательны для заполнения."
        crumbs={[{ title: "Запись на приём" }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <AppointmentForm />

          <aside className="space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Уважаемый пациент!</p>
              <p className="mt-2">
                Если вы записались на приём на нашем сайте, на ваш мобильный
                телефон в течение 12 часов перезвонит оператор регистратуры для
                подтверждения даты и времени.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Phone className="h-4 w-4 text-primary" />
                Регистратура
              </p>
              <p className="mt-2 text-muted-foreground">
                {appConfig.phones[0].number}
                <br />
                {appConfig.phones[1].number}
              </p>
              <p className="mt-4 flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4 text-primary" />
                Часы работы
              </p>
              <ul className="mt-2 text-muted-foreground">
                {appConfig.schedule.map((s) => (
                  <li key={s.day}>
                    {s.day}: {s.hours}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-muted-foreground">
              Запись через сайт не является экстренной. При острых состояниях
              обращайтесь по телефону регистратуры или в службу скорой помощи.
            </p>
          </aside>
        </div>
      </Section>
    </>
  );
}
