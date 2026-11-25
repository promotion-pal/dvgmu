import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card } from "@/shared/components/ui-bits";
import { faq } from "@/shared/data/faq";

export const metadata: Metadata = {
  title: "Вопрос-ответ",
  description:
    "Ответы врачей стоматологической поликлиники «Уни-Стом» на часто задаваемые вопросы пациентов.",
};

export default function FaqPage() {
  return (
    <>
      <PageHeader
        title="Вопрос-ответ"
        intro="Ответы специалистов поликлиники на часто задаваемые вопросы."
        crumbs={[{ title: "Пациентам", href: "/patients" }, { title: "Вопрос-ответ" }]}
      />

      <Section>
        <RevealGroup className="mx-auto max-w-3xl space-y-6">
          {faq.map((item) => (
            <RevealItem key={item.question}>
              <Card>
                <h2 className="text-lg font-semibold">{item.question}</h2>
                {item.author && (
                  <p className="mt-1 text-sm text-primary">{item.author}</p>
                )}
                <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                  {item.answer.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>

        <Reveal className="mx-auto mt-8 max-w-3xl text-sm text-muted-foreground">
          Не нашли ответ? Задайте вопрос в регистратуре по телефону или на
          приёме — врач ответит подробно с учётом вашей ситуации.
        </Reveal>
      </Section>
    </>
  );
}
