import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Медицинские работники",
  description:
    "Сведения о медицинских работниках стоматологической поликлиники «Уни-Стом»: профессора, доктора и кандидаты медицинских наук, врачи высшей категории.",
};

/** Имена, которые упоминаются в открытых разделах официального сайта
 *  (контакты, отзывы, вопрос-ответ). Полный поимённый список ведёт регистратура. */
const mentioned = [
  {
    name: "Чабан Александр Владимирович",
    role: "Главный врач, кандидат медицинских наук, доцент",
  },
  {
    name: "Хитрова Наталья Евгеньевна",
    role: "Заведующая лечебным отделением",
  },
  {
    name: "Кадукова Юлия Викторовна",
    role: "Врач-ортодонт",
  },
  {
    name: "Мушанков Владимир Николаевич",
    role: "Врач — стоматолог-хирург",
  },
  {
    name: "Шарова Татьяна Николаевна",
    role: "Врач — стоматолог-терапевт",
  },
  {
    name: "Миренкова Светлана Евгеньевна",
    role: "Врач — стоматолог-терапевт",
  },
];

export default function DoctorsPage() {
  return (
    <>
      <PageHeader
        title="Медицинские работники"
        intro="Приём и консультации ведут профессорско-преподавательский состав, доктора и кандидаты медицинских наук, врачи высшей квалификационной категории."
        crumbs={[{ title: "Врачи" }]}
      />

      <Section>
        <Reveal>
          <h2 className="text-2xl font-bold">
            Специалисты, упоминаемые на сайте поликлиники
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Ниже — врачи, чьи имена встречаются в разделах «Контакты»,
            «Вопрос-ответ» и в отзывах пациентов. Это не полный штат.
          </p>
        </Reveal>
        <RevealGroup className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {mentioned.map((d) => (
            <RevealItem key={d.name}>
              <Card className="h-full">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {d.name.split(" ")[0][0]}
                  {d.name.split(" ")[1]?.[0]}
                </div>
                <h3 className="mt-4 font-semibold">{d.name}</h3>
                <p className="mt-1 text-sm text-primary">{d.role}</p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section muted>
        <Reveal>
          <Notice>
            Полный документ «Сведения о медицинских работниках медицинской
            организации» (фамилии, должности, специальности, квалификационные
            категории, сведения об образовании) ведётся поликлиникой и
            предоставляется по запросу. Состав специалистов на конкретном приёме
            уточняйте в регистратуре:{" "}
            {appConfig.phones.registry.join(", ")}, либо при{" "}
            <Link href="/appointment" className="font-medium text-primary">
              записи на приём
            </Link>
            .
          </Notice>
        </Reveal>
      </Section>
    </>
  );
}
