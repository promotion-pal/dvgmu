import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Section, SectionTitle, Prose, Notice } from "@/shared/components/ui-bits";
import { vacanciesIntro, vacanciesOffer, vacanciesContact } from "@/shared/data/vacancies";

export const metadata: Metadata = {
  title: "Вакансии",
  description:
    "Вакансии консультативно-диагностической поликлиники «Клиника семейной медицины» ДВГМУ. Приглашаем врачей и средний медицинский персонал.",
};

export default function VacanciesPage() {
  return (
    <>
      <PageHeader
        title="Вакансии"
        intro="Работа в университетской клинике по принципу семейной медицины."
        crumbs={[{ title: "Вакансии" }]}
      />

      <Section>
        <div className="max-w-3xl">
          <Prose paragraphs={vacanciesIntro} />
        </div>
      </Section>

      <Section muted>
        <SectionTitle>Что мы предлагаем</SectionTitle>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {vacanciesOffer.map((o) => (
            <li key={o} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <div className="max-w-3xl">
          <Notice>{vacanciesContact}</Notice>
        </div>
      </Section>
    </>
  );
}
