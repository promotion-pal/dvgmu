import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Phone } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";
import { AppointmentForm } from "@/shared/components/appointment-form";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Запись на приём",
  description:
    "Запись на приём к врачу-стоматологу в поликлинике «Уни-Стом»: онлайн-форма и телефоны регистратуры. Хабаровск, ул. Муравьёва-Амурского, 30.",
};

export default function AppointmentPage() {
  return (
    <>
      <PageHeader
        title="Запись на приём"
        intro="Запишитесь онлайн или позвоните в регистратуру. После онлайн-заявки оператор перезвонит в течение 3 рабочих дней."
        crumbs={[{ title: "Запись на приём" }]}
      />

      <Section>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
          <Reveal>
            <AppointmentForm />
          </Reveal>

          <Reveal delay={0.1} className="space-y-6">
            <Card>
              <h3 className="flex items-center gap-2 font-semibold">
                <Phone className="h-4 w-4 text-primary" />
                Регистратура
              </h3>
              <ul className="mt-3 space-y-1 text-sm">
                {appConfig.phones.registry.map((p) => (
                  <li key={p}>
                    <a
                      href={`tel:${p.replace(/[^\d+]/g, "")}`}
                      className="font-medium text-primary"
                    >
                      {p}
                    </a>
                  </li>
                ))}
                <li className="text-muted-foreground">
                  Приёмная: {appConfig.phones.reception}
                </li>
              </ul>
            </Card>

            <Card>
              <h3 className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4 text-primary" />
                Часы работы
              </h3>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                <li>{appConfig.schedule.weekdays}</li>
                <li>{appConfig.schedule.saturday}</li>
                <li>{appConfig.schedule.sunday}</li>
              </ul>
            </Card>

            <Notice>
              Для приёма по ОМС при себе иметь документы из раздела{" "}
              <Link href="/patients#budget" className="font-medium text-primary">
                «Пациентам»
              </Link>
              : паспорт, полис ОМС, данные флюорографии, крови на RW, прививки от
              дифтерии.
            </Notice>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
