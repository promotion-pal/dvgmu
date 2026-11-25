import type { Metadata } from "next";
import { Quote } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";
import { reviews } from "@/shared/data/reviews";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Отзывы пациентов",
  description:
    "Отзывы и благодарности пациентов стоматологической поликлиники «Уни-Стом».",
};

export default function ReviewsPage() {
  return (
    <>
      <PageHeader
        title="Отзывы пациентов"
        intro="Благодарности врачам и отделениям поликлиники."
        crumbs={[{ title: "Отзывы" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {reviews.map((r) => (
            <RevealItem key={r.author + r.date}>
              <Card className="h-full">
                <Quote className="h-6 w-6 text-primary/40" />
                <p className="mt-3 text-muted-foreground italic">«{r.text}»</p>
                <p className="mt-4 text-sm font-semibold">
                  {r.author}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {r.date}
                  </span>
                </p>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-8">
          <Notice>
            Оставить отзыв можно в регистратуре, по электронной почте{" "}
            {appConfig.email} или через форму на официальном сайте поликлиники.
          </Notice>
        </div>
      </Section>
    </>
  );
}
