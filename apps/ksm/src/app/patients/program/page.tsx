import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Section, Prose, Notice } from "@/shared/components/ui-bits";
import { territorialProgram } from "@/shared/data/insurance";

export const metadata: Metadata = {
  title: "Территориальная программа госгарантий",
  description:
    "Территориальная программа государственных гарантий бесплатного оказания гражданам медицинской помощи в Хабаровском крае и участие в ней «Клиники семейной медицины».",
};

export default function ProgramGuaranteesPage() {
  return (
    <>
      <PageHeader
        title="Территориальная программа государственных гарантий"
        intro="Бесплатное оказание гражданам медицинской помощи на территории Хабаровского края."
        crumbs={[
          { title: "Пациентам", href: "/patients" },
          { title: "Территориальная программа" },
        ]}
      />

      <Section>
        <div className="max-w-3xl">
          <Prose paragraphs={territorialProgram.body} />
        </div>
        <div className="mt-8 max-w-3xl">
          <Notice>
            Основной документ: {territorialProgram.doc}. Полный текст программы
            публикуется на официальном интернет-портале нормативных правовых актов
            Хабаровского края и на сайте Министерства здравоохранения края.
          </Notice>
        </div>
      </Section>
    </>
  );
}
