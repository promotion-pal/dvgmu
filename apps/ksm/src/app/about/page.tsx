import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { Section, SectionTitle, Card } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "О клинике",
  description:
    "Сведения о консультативно-диагностической поликлинике «Клиника семейной медицины» ДВГМУ: история, лицензия, руководство, принципы работы.",
};

const values = [
  "Внимательное отношение к каждому пациенту",
  "Единый диагностический и лечебный подход",
  "Легитимность оказываемых медицинских услуг",
  "Оптимальные лечебно-профилактические программы",
  "Высококвалифицированный медицинский персонал",
  "Сервис европейского уровня",
  "Сотрудничество науки и практики",
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="О клинике"
        intro="Консультативно-диагностическая поликлиника «Клиника семейной медицины» — структурное подразделение Дальневосточного государственного медицинского университета Минздрава России."
        crumbs={[{ title: "О клинике" }]}
      />

      <Section>
        <div className="max-w-3xl space-y-4 text-muted-foreground">
          <p>
            «Клиника семейной медицины» является структурным подразделением
            федерального государственного бюджетного образовательного учреждения
            высшего образования «Дальневосточный государственный медицинский
            университет» Министерства здравоохранения Российской Федерации.
            Клиника осуществляет медицинскую деятельность по принципу семейной
            медицины на основании лицензии и в соответствии с действующим
            законодательством РФ.
          </p>
          <p>
            Поликлиника основана в {appConfig.founded.year} году
            ({appConfig.founded.order}). Консультативно-диагностическая помощь
            строится по принципу семейной медицины: за здоровьем всей семьи
            наблюдает врач общей практики, при необходимости подключаются
            профильные специалисты клиники.
          </p>
          <p>
            Финансирование осуществляется за счёт средств обязательного
            медицинского страхования, приносящей доход деятельности, добровольного
            медицинского страхования и средств предприятий.
          </p>
        </div>
      </Section>

      <Section muted>
        <SectionTitle>Реквизиты и лицензия</SectionTitle>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Card>
            <p className="font-semibold">Полное наименование</p>
            <p className="mt-2 text-sm text-muted-foreground">{appConfig.legalName}</p>
          </Card>
          <Card>
            <p className="font-semibold">Лицензия</p>
            <p className="mt-2 text-sm text-muted-foreground">
              На осуществление медицинской деятельности {appConfig.license}
            </p>
          </Card>
          <Card>
            <p className="font-semibold">Адрес</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {appConfig.address.full} ({appConfig.address.landmark})
            </p>
          </Card>
          <Card>
            <p className="font-semibold">Режим работы</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {appConfig.schedule.map((s) => (
                <li key={s.day}>
                  {s.day}: {s.hours}
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <p className="mt-6 text-sm">
          <Link href="/documents" className="font-medium text-primary">
            Все документы клиники →
          </Link>
        </p>
      </Section>

      <Section>
        <SectionTitle>Руководство</SectionTitle>
        <Card className="mt-6 max-w-2xl">
          <p className="text-lg font-semibold">{appConfig.chief.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{appConfig.chief.position}</p>
          <p className="mt-4 border-l-2 border-primary/40 pl-4 text-muted-foreground italic">
            «{appConfig.chief.quote}»
          </p>
        </Card>
      </Section>

      <Section muted>
        <SectionTitle>Наши принципы</SectionTitle>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {values.map((v) => (
            <li key={v} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{v}</span>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
