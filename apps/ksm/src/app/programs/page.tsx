import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section } from "@/shared/components/ui-bits";
import { programs } from "@/shared/data/programs";

export const metadata: Metadata = {
  title: "Комплексные программы",
  description:
    "Комплексные лечебно-профилактические и диагностические программы «Клиники семейной медицины»: боль в спине, радиоволновая хирургия новообразований, комплексная диагностика зрения, экспресс-лаборатория «Цито».",
};

export default function ProgramsPage() {
  const treatment = programs.filter((p) => p.kind === "Лечебно-профилактическая программа");
  const diagnostic = programs.filter((p) => p.kind === "Диагностическая программа");

  const renderGroup = (title: string, items: typeof programs) => (
    <Section muted={title === "Диагностические программы"}>
      <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {items.map((p) => (
          <Link
            key={p.slug}
            href={`/programs/${p.slug}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
          >
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.summary}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Подробнее
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </Link>
        ))}
      </div>
    </Section>
  );

  return (
    <>
      <PageHeader
        title="Комплексные программы"
        intro="Готовые наборы обследований и процедур по фиксированной стоимости — разработаны специалистами клиники."
        crumbs={[{ title: "Программы" }]}
      />
      {renderGroup("Лечебно-профилактические программы", treatment)}
      {renderGroup("Диагностические программы", diagnostic)}
    </>
  );
}
