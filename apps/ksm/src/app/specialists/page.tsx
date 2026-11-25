import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { Section, SectionTitle, Card, Notice } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Специалистам",
  description:
    "Информация для медицинских специалистов: порядки оказания медицинской помощи, стандарты, клинические рекомендации, вакансии «Клиники семейной медицины» ДВГМУ.",
};

const resources = [
  {
    title: "Порядки оказания медицинской помощи",
    text: "Утверждаются Минздравом России по профилям и определяют этапность и условия оказания помощи, оснащение и штатные нормативы.",
  },
  {
    title: "Стандарты медицинской помощи",
    text: "Устанавливают усреднённые показатели частоты и кратности применения медицинских услуг, лекарственных препаратов и расходных материалов.",
  },
  {
    title: "Клинические рекомендации",
    text: "Документы по вопросам профилактики, диагностики, лечения и реабилитации, размещаются в Рубрикаторе клинических рекомендаций Минздрава России.",
  },
];

export default function SpecialistsPage() {
  return (
    <>
      <PageHeader
        title="Специалистам"
        intro="Нормативная база и профессиональные ресурсы для врачей и среднего медицинского персонала."
        crumbs={[{ title: "Специалистам" }]}
      />

      <Section>
        <div className="grid gap-6 md:grid-cols-3">
          {resources.map((r) => (
            <Card key={r.title}>
              <h3 className="font-semibold">{r.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
            </Card>
          ))}
        </div>
        <div className="mt-8 max-w-3xl">
          <Notice>
            Актуальные редакции порядков, стандартов и клинических рекомендаций
            публикуются на официальном сайте Министерства здравоохранения
            Российской Федерации и в Рубрикаторе клинических рекомендаций
            (cr.minzdrav.gov.ru).
          </Notice>
        </div>
      </Section>

      <Section muted>
        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <SectionTitle>Взаимодействие со страховыми компаниями</SectionTitle>
            <p className="mt-4 text-sm text-muted-foreground">
              По вопросам оказания и оплаты медицинской помощи в системе ОМС и ДМС
              обращайтесь к администратору для страховых компаний:
            </p>
            <p className="mt-2 font-semibold">8 (4212) 31-68-30</p>
          </Card>
          <Card>
            <SectionTitle>Вакансии</SectionTitle>
            <p className="mt-4 text-sm text-muted-foreground">
              Клиника приглашает к сотрудничеству врачей и средний медицинский
              персонал. Актуальный перечень вакантных должностей —{" "}
              <Link href="/vacancies" className="font-medium text-primary">
                на странице «Вакансии»
              </Link>
              .
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Приёмная главного врача: {appConfig.phones[4].number},{" "}
              {appConfig.email}.
            </p>
          </Card>
        </div>
      </Section>
    </>
  );
}
