import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Notice } from "@/shared/components/ui-bits";
import { vacancies, vacancyContact } from "@/shared/data/vacancies";

export const metadata: Metadata = {
  title: "Вакансии",
  description:
    "Открытые вакансии стоматологической поликлиники «Уни-Стом» ФГБОУ ВО ДВГМУ Минздрава России в Хабаровске.",
};

export default function VacanciesPage() {
  return (
    <>
      <PageHeader
        title="Вакансии"
        intro="Поликлиника приглашает на работу специалистов. Условия и требования уточняются по телефону."
        crumbs={[{ title: "Вакансии" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {vacancies.map((v) => (
            <RevealItem
              key={v}
              className="rounded-xl border border-border bg-card px-5 py-4 font-medium shadow-sm"
            >
              {v}
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-8">
          <Notice>{vacancyContact}</Notice>
        </Reveal>
      </Section>
    </>
  );
}
