import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";

export const metadata: Metadata = {
  title: "Информация для специалистов",
  description:
    "Порядки оказания медицинской помощи, стандарты и клинические рекомендации по стоматологии для специалистов.",
};

const sections = [
  {
    title: "Порядки оказания медицинской помощи",
    text: "Нормативные порядки оказания медицинской помощи при стоматологических заболеваниях взрослому и детскому населению, утверждённые Минздравом России.",
  },
  {
    title: "Стандарты медицинской помощи",
    text: "Стандарты медицинской помощи по профилю «стоматология» — перечни медицинских услуг, лекарственных препаратов и расходных материалов.",
  },
  {
    title: "Клинические рекомендации",
    text: "Актуальные клинические рекомендации (протоколы лечения) профессиональных стоматологических ассоциаций по основным нозологиям.",
  },
];

export default function SpecialistsPage() {
  return (
    <>
      <PageHeader
        title="Информация для специалистов"
        intro="Поликлиника — клиническая база стоматологического факультета ДВГМУ. Здесь ведётся учебная, научная и методическая работа."
        crumbs={[{ title: "Специалистам" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {sections.map((s) => (
            <RevealItem key={s.title}>
              <Card className="h-full">
                <h2 className="text-lg font-semibold">{s.title}</h2>
                <p className="mt-3 text-sm text-muted-foreground">{s.text}</p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section muted>
        <Reveal>
          <h2 className="text-2xl font-bold">Научная и учебная деятельность</h2>
          <p className="mt-4 max-w-3xl text-muted-foreground">
            На базе поликлиники работают четыре кафедры стоматологического
            факультета. Сотрудники участвуют во всероссийских и международных
            научно-практических конференциях, семинарах по онкопрофилактике и
            скринингу, ведут подготовку и повышение квалификации
            врачей-стоматологов.
          </p>
        </Reveal>
      </Section>

      <Section>
        <Reveal>
          <Notice>
            Полные тексты порядков, стандартов и клинических рекомендаций
            размещены на официальных ресурсах Минздрава России и профильных
            ассоциаций. Актуальные редакции документов уточняйте в
            организационно-методическом отделе поликлиники.
          </Notice>
        </Reveal>
      </Section>
    </>
  );
}
