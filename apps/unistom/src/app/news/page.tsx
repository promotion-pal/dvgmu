import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";
import { news } from "@/shared/data/news";

export const metadata: Metadata = {
  title: "Новости",
  description:
    "Новости, конференции и мероприятия стоматологической поликлиники «Уни-Стом» ФГБОУ ВО ДВГМУ Минздрава России.",
};

export default function NewsPage() {
  return (
    <>
      <PageHeader
        title="Новости"
        intro="События, конференции и мероприятия поликлиники."
        crumbs={[{ title: "Новости" }]}
      />

      <Section>
        <RevealGroup className="space-y-6">
          {news.map((n) => (
            <RevealItem key={n.slug} id={n.slug} className="scroll-mt-28">
              <Card>
                <span className="text-sm font-medium text-primary">{n.date}</span>
                <h2 className="mt-1 text-xl font-semibold">{n.title}</h2>
                <p className="mt-3 text-muted-foreground">{n.summary}</p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-8">
          <Notice>
            Полные тексты части материалов публикуются на официальном сайте
            поликлиники и на сайте ДВГМУ (fesmu.ru).
          </Notice>
        </div>
      </Section>
    </>
  );
}
