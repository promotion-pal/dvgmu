import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Section } from "@/shared/components/ui-bits";
import { faq } from "@/shared/data/faq";

export const metadata: Metadata = {
  title: "Вопрос-ответ",
  description:
    "Ответы врачей «Клиники семейной медицины» на частые вопросы пациентов: запись на приём, лечение, УЗИ детям, справки, дневной стационар.",
};

export default function FaqPage() {
  return (
    <>
      <PageHeader
        title="Вопрос-ответ"
        intro="Ответы на частые вопросы пациентов клиники."
        crumbs={[
          { title: "Пациентам", href: "/patients" },
          { title: "Вопрос-ответ" },
        ]}
      />

      <Section>
        <div className="mx-auto max-w-3xl divide-y divide-border">
          {faq.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium">
                <span>{item.q}</span>
                <span className="mt-1 shrink-0 text-primary transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </>
  );
}
