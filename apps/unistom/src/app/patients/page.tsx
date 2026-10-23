import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice, LinkCard } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Информация для пациентов",
  description:
    "Бюджетная стоматологическая помощь, права и обязанности пациентов, график работы врачей, документы для записи на приём в поликлинике «Уни-Стом».",
};

const preferential = [
  "Инвалиды и участники Великой Отечественной войны",
  "Труженики тыла",
  "Члены семей погибших участников ВОВ",
  "Жители блокадного Ленинграда",
  "Реабилитированные и репрессированные лица",
  "Бывшие узники фашистских концлагерей",
  "Призывники (по направлению военно-врачебной комиссии)",
  "Почётные доноры",
  "Пациенты с острой болью",
];

const docsForVisit = [
  "Паспорт (для детей — свидетельство о рождении)",
  "Полис обязательного медицинского страхования",
  "Данные флюорографического обследования",
  "Анализ крови на RW",
  "Сведения о прививке от дифтерии",
];

const schedule = [
  "Ортодонтический кабинет (каб. 108)",
  "Специалисты по платным услугам (каб. 109, 111)",
  "Пародонтологический кабинет (каб. 110)",
  "Хирургический кабинет по ОМС (каб. 113)",
  "Хирургический кабинет, платные услуги (каб. 114)",
  "Рентген-кабинет (каб. 116)",
  "Ортопедическое отделение (каб. 118, 120)",
  "Специалисты по ОМС (каб. 122)",
];

export default function PatientsPage() {
  return (
    <>
      <PageHeader
        title="Информация для пациентов"
        intro="Как получить бесплатную стоматологическую помощь, какие документы нужны и где посмотреть график работы врачей."
        crumbs={[{ title: "Пациентам" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <RevealItem>
            <LinkCard
              href="/patients/faq"
              title="Вопрос-ответ"
              description="Ответы врачей поликлиники на частые вопросы пациентов."
            />
          </RevealItem>
          <RevealItem>
            <LinkCard
              href="/appointment"
              title="Запись на приём"
              description="Онлайн-форма и телефоны регистратуры."
            />
          </RevealItem>
          <RevealItem>
            <LinkCard
              href="/reviews"
              title="Отзывы пациентов"
              description="Благодарности врачам и отделениям поликлиники."
            />
          </RevealItem>
        </RevealGroup>
      </Section>

      <Section muted>
        <div id="budget" className="scroll-mt-28" />
        <Reveal>
          <h2 className="text-2xl font-bold">Бюджетная стоматологическая помощь</h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Помощь оказывается пациентам, имеющим право на бесплатное лечение по
            территориальной программе ОМС Хабаровского края. Право на
            первоочередное обслуживание имеют:
          </p>
        </Reveal>
        <RevealGroup className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preferential.map((p) => (
            <RevealItem
              key={p}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              {p}
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
          <Reveal>
            <Card>
              <h3 className="font-semibold">Документы для записи на приём</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {docsForVisit.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card>
              <h3 className="font-semibold">Что входит в бесплатную помощь</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Осмотр, местная анестезия, базовая рентгенодиагностика, лечение
                кариеса, пульпита и периодонтита стандартными материалами,
                удаление зубов, лечение заболеваний дёсен, обучение гигиене
                полости рта, снятие зубных отложений, ряд амбулаторных
                хирургических вмешательств.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Не входят: лазерные технологии и отдельные современные материалы
                (фотополимеры, NiTi-инструменты и др.) — они предоставляются как
                платные услуги.
              </p>
            </Card>
          </Reveal>
        </div>

        <Reveal className="mt-6">
          <Notice>
            Запись на бюджетный приём — по телефонам регистратуры:{" "}
            {appConfig.phones.registry.join(", ")}.
          </Notice>
        </Reveal>
      </Section>

      <Section>
        <div id="rights" className="scroll-mt-28" />
        <Reveal>
          <h2 className="text-2xl font-bold">
            Права и обязанности в сфере охраны здоровья
          </h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Права и обязанности граждан при получении медицинской помощи
            определяются следующими нормативными документами:
          </p>
        </Reveal>
        <RevealGroup className="mt-6 space-y-3">
          {[
            "Федеральный закон РФ от 21.11.2011 № 323-ФЗ «Об основах охраны здоровья граждан в Российской Федерации»",
            "Приказ Минздравсоцразвития России от 07.12.2011 № 1496н «Об утверждении Порядка оказания медицинской помощи взрослому населению при стоматологических заболеваниях»",
            "Приказ Минздрава России от 14.04.2025 № 216н «Об утверждении Порядка выбора гражданином медицинской организации»",
          ].map((doc) => (
            <RevealItem
              key={doc}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
            >
              {doc}
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section muted>
        <div id="schedule" className="scroll-mt-28" />
        <Reveal>
          <h2 className="text-2xl font-bold">График работы врачей</h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            Приём ведётся по кабинетам. Актуальные графики по каждому кабинету
            размещаются на информационных стендах поликлиники и уточняются в
            регистратуре — расписание конкретных специалистов периодически
            меняется.
          </p>
        </Reveal>
        <RevealGroup className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {schedule.map((s) => (
            <RevealItem
              key={s}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              {s}
            </RevealItem>
          ))}
        </RevealGroup>
        <Reveal className="mt-6">
          <Notice>
            Часы работы поликлиники: {appConfig.schedule.weekdays};{" "}
            {appConfig.schedule.saturday}; {appConfig.schedule.sunday}.{" "}
            <Link href="/contacts" className="font-medium text-primary">
              Контакты и схема проезда →
            </Link>
          </Notice>
        </Reveal>
      </Section>
    </>
  );
}
