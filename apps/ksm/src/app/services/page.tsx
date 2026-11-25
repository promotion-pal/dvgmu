import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section, SectionTitle, Prose } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";
import { services, servicesIntro } from "@/shared/data/services";
import { programs } from "@/shared/data/programs";

export const metadata: Metadata = {
  title: "Услуги и направления помощи",
  description:
    "Направления медицинской помощи «Клиники семейной медицины» ДВГМУ: терапия, педиатрия, кардиология, неврология, эндокринология, гинекология, УЗИ, лаборатория, физиотерапия, дневной стационар. Платные услуги и прейскурант.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Услуги и направления помощи"
        intro="Амбулаторная консультативно-диагностическая помощь по программе ОМС, по договорам ДМС и на платной основе."
        crumbs={[{ title: "Услуги" }]}
      />

      <Section>
        <Prose paragraphs={servicesIntro} />
      </Section>

      <Section muted>
        <SectionTitle>Направления</SectionTitle>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.slug}
              id={s.slug}
              className="scroll-mt-24 rounded-xl border border-border bg-card p-5 shadow-sm"
            >
              <h3 className="font-semibold">{s.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.short}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 md:p-8">
          <SectionTitle>Платные услуги</SectionTitle>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Платные медицинские услуги оказываются по действующему прейскуранту.
            Полный прайс-лист опубликован на официальном сайте клиники в формате
            PDF. Стоимость и порядок оказания услуг уточняйте в регистратуре по
            телефонам {appConfig.phones[0].number} и {appConfig.phones[1].number}.
          </p>
          <a
            href={appConfig.priceListUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
          >
            <Download className="h-4 w-4" />
            Скачать прайс-лист (PDF)
          </a>
        </div>
      </Section>

      <Section muted>
        <SectionTitle>Комплексные программы</SectionTitle>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {programs.map((p) => (
            <Link
              key={p.slug}
              href={`/programs/${p.slug}`}
              className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
            >
              <span className="text-xs font-medium text-primary">{p.kind}</span>
              <h3 className="mt-1 font-semibold">{p.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.summary}</p>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
