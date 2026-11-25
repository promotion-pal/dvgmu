import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { Section } from "@/shared/components/ui-bits";
import { newsSorted, formatDate } from "@/shared/data/news";

export const metadata: Metadata = {
  title: "Новости",
  description:
    "Новости и события консультативно-диагностической поликлиники «Клиника семейной медицины» ДВГМУ.",
};

export default function NewsPage() {
  return (
    <>
      <PageHeader
        title="Новости"
        intro="События клиники, памятки для пациентов, объявления о режиме работы."
        crumbs={[{ title: "Новости" }]}
      />

      <Section>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {newsSorted.map((n) => (
            <Link
              key={n.slug}
              href={`/news/${n.slug}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
            >
              <span className="text-sm font-medium text-primary">
                {formatDate(n.date)}
              </span>
              <h2 className="mt-2 font-semibold">{n.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {n.summary}
              </p>
              <span className="mt-4 text-sm font-medium text-primary">
                Читать →
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
