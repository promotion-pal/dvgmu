import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section, Notice } from "@/shared/components/ui-bits";
import { documents, documentsNote } from "@/shared/data/documents";

export const metadata: Metadata = {
  title: "Документы",
  description:
    "Документы «Клиники семейной медицины» ДВГМУ: лицензия на медицинскую деятельность, положение о поликлинике, свидетельство ЕГРЮЛ, устав ДВГМУ.",
};

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Документы"
        intro="Учредительные и разрешительные документы медицинской организации."
        crumbs={[{ title: "Документы" }]}
      />

      <Section>
        <div className="space-y-4">
          {documents.map((d) => (
            <div
              key={d.title}
              className="flex items-start gap-4 rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <FileText className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <h2 className="font-semibold">{d.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{d.note}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 max-w-3xl">
          <Notice>{documentsNote}</Notice>
        </div>
      </Section>
    </>
  );
}
