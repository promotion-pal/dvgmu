import type { Metadata } from "next";
import { Building2, Mail, MapPin, Phone, User } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card } from "@/shared/components/ui-bits";
import { oversightBodies } from "@/shared/data/oversight";

export const metadata: Metadata = {
  title: "Вышестоящие и контролирующие органы",
  description:
    "Контактные данные органов, осуществляющих контроль за деятельностью стоматологической поликлиники «Уни-Стом»: Росздравнадзор, Роспотребнадзор, Минздрав Хабаровского края, ТФОМС, страховая компания.",
};

export default function OversightPage() {
  return (
    <>
      <PageHeader
        title="Вышестоящие и контролирующие органы"
        intro="Органы, в которые можно обратиться по вопросам оказания медицинской помощи."
        crumbs={[{ title: "Контролирующие органы" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {oversightBodies.map((b) => (
            <RevealItem key={b.name}>
              <Card className="h-full">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-1 h-5 w-5 shrink-0 text-primary" />
                  <h2 className="font-semibold">{b.name}</h2>
                </div>
                <dl className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {b.head && (
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b.head}</span>
                    </div>
                  )}
                  {b.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b.address}</span>
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-start gap-2">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b.phone}</span>
                    </div>
                  )}
                  {b.email && (
                    <div className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b.email}</span>
                    </div>
                  )}
                  {b.site && (
                    <div className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{b.site}</span>
                    </div>
                  )}
                </dl>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>
    </>
  );
}
