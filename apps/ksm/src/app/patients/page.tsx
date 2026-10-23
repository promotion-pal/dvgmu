import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Section, SectionTitle, LinkCard, Card } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Пациентам",
  description:
    "Информация для пациентов «Клиники семейной медицины»: права и обязанности граждан, диспансеризация, страховые организации, что взять с собой на приём.",
};

const links = [
  {
    href: "/patients/program",
    title: "Территориальная программа госгарантий",
    description: "Виды и условия бесплатной медицинской помощи в Хабаровском крае.",
  },
  {
    href: "/patients/screening",
    title: "Диспансеризация и профосмотры",
    description: "Кто и как часто проходит, что входит в обследование, как подготовиться.",
  },
  {
    href: "/patients/insurance",
    title: "Страховые организации",
    description: "Компании ОМС и ДМС, с которыми у клиники заключены договоры.",
  },
  {
    href: "/patients/faq",
    title: "Вопрос-ответ",
    description: "Ответы на частые вопросы пациентов.",
  },
  {
    href: "/medication",
    title: "Лекарственное обеспечение",
    description: "Перечни жизненно необходимых и льготных лекарственных препаратов.",
  },
  {
    href: "/documents",
    title: "Документы",
    description: "Лицензия, положение о поликлинике, устав ДВГМУ.",
  },
];

const rights = [
  "Уважительное и гуманное отношение со стороны медицинских работников",
  "Выбор врача и медицинской организации в порядке, установленном законодательством",
  "Обследование, лечение и содержание в надлежащих санитарно-гигиенических условиях",
  "Получение информации о своих правах, обязанностях и состоянии здоровья",
  "Защита сведений, составляющих врачебную тайну",
  "Отказ от медицинского вмешательства",
  "Возмещение вреда, причинённого здоровью при оказании медицинской помощи",
];

const bring = [
  "Документ, удостоверяющий личность (паспорт), для детей — свидетельство о рождении",
  "Полис ОМС (или договор ДМС) при обращении за помощью по страхованию",
  "СНИЛС",
  "Направление и результаты ранее выполненных обследований, если они есть",
  "Амбулаторную карту или выписки при наличии",
];

export default function PatientsPage() {
  return (
    <>
      <PageHeader
        title="Пациентам"
        intro="Права и обязанности, порядок получения помощи, диспансеризация и полезные памятки."
        crumbs={[{ title: "Пациентам" }]}
      />

      <Section>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <LinkCard key={l.href} {...l} />
          ))}
        </div>
      </Section>

      <Section muted>
        <SectionTitle>Права граждан в сфере охраны здоровья</SectionTitle>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Права пациентов закреплены Федеральным законом от 21.11.2011 № 323-ФЗ
          «Об основах охраны здоровья граждан в Российской Федерации». При
          оказании медицинской помощи пациент имеет право на:
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {rights.map((r) => (
            <li key={r} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <SectionTitle>Что взять на приём</SectionTitle>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {bring.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <SectionTitle>Режим работы и запись</SectionTitle>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {appConfig.schedule.map((s) => (
                <li key={s.day}>
                  {s.day}: {s.hours}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Запись на приём — по телефонам регистратуры {appConfig.phones[0].number},{" "}
              {appConfig.phones[1].number} или через форму на сайте. УЗИ детям и
              приём в субботу — только по предварительной записи.
            </p>
          </Card>
        </div>
      </Section>
    </>
  );
}
