import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section } from "@/shared/components/ui-bits";
import { articles } from "@/shared/data/articles";

export const metadata: Metadata = {
  title: "Статьи",
  description:
    "Полезная информация от врачей стоматологической поликлиники «Уни-Стом»: гигиена при ортодонтическом лечении, детская стоматология и другое.",
};

export default function ArticlesPage() {
  return (
    <>
      <PageHeader
        title="Статьи"
        intro="Полезная информация от специалистов поликлиники."
        crumbs={[{ title: "Статьи" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {articles.map((a) => (
            <RevealItem key={a.slug}>
              <Link
                href={`/articles/${a.slug}`}
                className="group flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <h2 className="text-lg font-semibold">{a.title}</h2>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {a.summary}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Читать
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>
    </>
  );
}
