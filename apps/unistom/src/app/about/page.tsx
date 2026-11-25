import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Сведения о медицинской организации",
  description:
    "Стоматологическая поликлиника «Уни-Стом» ФГБОУ ВО ДВГМУ Минздрава России: назначение, финансирование, кафедры, руководство.",
};

const departments = [
  "Кафедра ортопедической стоматологии",
  "Кафедра стоматологии детского возраста",
  "Кафедра терапевтической стоматологии",
  "Кафедра хирургической стоматологии и челюстно-лицевой хирургии",
];

const funding = [
  "Средства обязательного медицинского страхования (ОМС)",
  "Приносящая доход деятельность",
  "Средства добровольного медицинского страхования (ДМС)",
  "Средства предприятий",
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="Сведения о медицинской организации"
        intro={appConfig.tagline}
        crumbs={[{ title: "О поликлинике" }]}
      />

      <Section>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[2fr_1fr]">
          <Reveal className="space-y-4 text-muted-foreground">
            <h2 className="text-2xl font-bold text-foreground">Об организации</h2>
            <p>
              {appConfig.fullName} — клиника федерального подчинения. Учредитель —{" "}
              {appConfig.parentOrg}.
            </p>
            <p>
              Поликлиника является учебным, научным и лечебным комплексом и
              служит клинической базой стоматологического факультета
              университета. Здесь оказывают квалифицированную стоматологическую
              помощь населению Хабаровска и края и одновременно готовят
              специалистов-стоматологов.
            </p>
            <p>
              Стоматологическую помощь оказывают
              профессорско-преподавательский состав, доктора и кандидаты
              медицинских наук, врачи высшей квалификационной категории.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <Card>
              <h3 className="font-semibold">Руководство</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {appConfig.chief.position}
              </p>
              <p className="mt-1 font-medium">{appConfig.chief.name}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Телефон приёмной главного врача: {appConfig.phones.chief}
              </p>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section muted>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <Reveal>
            <h2 className="text-2xl font-bold">Кафедры в поликлинике</h2>
            <ul className="mt-4 space-y-3">
              {departments.map((d) => (
                <li key={d} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-2xl font-bold">Финансирование</h2>
            <ul className="mt-4 space-y-3">
              {funding.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </Section>

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { value: "20+", label: "лет опыта у ведущих врачей" },
            { value: "4", label: "профильные кафедры ДВГМУ" },
            { value: "ОМС / ДМС", label: "формы оказания помощи" },
            { value: "1958", label: "год основания ДВГМУ" },
          ].map((s) => (
            <RevealItem key={s.label}>
              <Card className="text-center">
                <p className="text-2xl font-bold text-primary">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
        <Reveal className="mt-8">
          <Notice>
            Полный комплект сведений о медицинской организации (структура,
            учредительные документы, данные о медицинских работниках,
            территориальная программа госгарантий) размещён в разделе{" "}
            <a href="/documents" className="font-medium text-primary">
              «Документы»
            </a>{" "}
            и предоставляется по запросу в регистратуре.
          </Notice>
        </Reveal>
      </Section>
    </>
  );
}
