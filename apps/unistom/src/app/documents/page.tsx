import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";
import { documentGroups } from "@/shared/data/documents";

export const metadata: Metadata = {
  title: "Документы",
  description:
    "Лицензия, уставные и нормативные документы, прейскурант стоматологической поликлиники «Уни-Стом».",
};

export default function DocumentsPage() {
  return (
    <>
      <PageHeader
        title="Документы"
        intro="Учредительные, разрешительные и нормативные документы поликлиники."
        crumbs={[{ title: "Документы" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {documentGroups.map((g) => (
            <RevealItem key={g.group}>
              <Card className="h-full">
                <h2 className="font-semibold">{g.group}</h2>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {g.items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mt-8">
          <Notice>
            Копии документов размещены на официальном сайте поликлиники и
            предоставляются по запросу в регистратуре. Прейскурант на 2026 год
            выдаётся на приёме и размещён на информационных стендах.
          </Notice>
        </Reveal>
      </Section>
    </>
  );
}
