import type { Metadata } from "next";
import { Quote } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section, Notice } from "@/shared/components/ui-bits";
import { reviews } from "@/shared/data/reviews";

export const metadata: Metadata = {
  title: "Отзывы",
  description:
    "Отзывы пациентов о врачах и работе консультативно-диагностической поликлиники «Клиника семейной медицины» ДВГМУ.",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ReviewsPage() {
  return (
    <>
      <PageHeader
        title="Отзывы пациентов"
        intro="Мнения пациентов о врачах и обслуживании в клинике."
        crumbs={[{ title: "Отзывы" }]}
      />

      <Section>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {reviews.map((r, i) => (
            <figure
              key={i}
              className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <Quote className="h-6 w-6 text-primary/40" />
              <blockquote className="mt-3 flex-1 text-sm text-muted-foreground">
                {r.text}
              </blockquote>
              <figcaption className="mt-4 text-sm">
                <span className="font-semibold">{r.author}</span>
                <span className="text-muted-foreground"> · {formatDate(r.date)}</span>
                {r.about && (
                  <span className="block text-xs text-muted-foreground">{r.about}</span>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="mt-8 max-w-3xl">
          <Notice>
            Оставить отзыв или благодарность можно в регистратуре, в приёмной
            главного врача (8 (4212) 30-34-74) или по электронной почте
            fmc@mail.fesmu.ru.
          </Notice>
        </div>
      </Section>
    </>
  );
}
