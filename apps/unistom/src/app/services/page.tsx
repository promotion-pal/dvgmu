import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, Card, Notice } from "@/shared/components/ui-bits";
import { services, paidFunding } from "@/shared/data/services";

export const metadata: Metadata = {
  title: "Услуги",
  description:
    "Направления помощи стоматологической поликлиники «Уни-Стом»: терапия, ортопедия, хирургия, имплантация, ортодонтия, пародонтология, гигиена, отбеливание, детская стоматология. Помощь по ОМС и платно.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Услуги"
        intro="Помощь по любому разделу стоматологии — по программе ОМС Хабаровского края, по ДМС и на платной основе."
        crumbs={[{ title: "Услуги" }]}
      />

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {services.map((s) => (
            <RevealItem key={s.slug} id={s.slug} className="scroll-mt-28">
              <Card className="h-full">
                <h2 className="text-xl font-semibold">{s.name}</h2>
                <p className="mt-2 text-sm font-medium text-primary">
                  {s.short}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {s.details.map((d) => (
                    <li key={d} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section muted>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <Reveal>
            <h2 className="text-2xl font-bold">Платные услуги</h2>
            <p className="mt-4 text-muted-foreground">
              Платные медицинские услуги оказываются за счёт:
            </p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {paidFunding.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-muted-foreground">
              В перечень платных услуг входят эксклюзивные методы диагностики
              (все методы рентгендиагностики, Florida Probe), эффективное
              обезболивание, профессиональная гигиена, художественная
              реставрация, лечение заболеваний дёсен, хирургические
              вмешательства и остеопластика, все виды протезирования, брекет-
              системы, имплантология, консультативный приём профессора,
              физиотерапия, декорирование зубов и детская стоматология.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <Card>
              <h3 className="font-semibold">Прейскурант</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Действует «Прейскурант на 2026 год». Актуальную стоимость по
                конкретной услуге уточняйте в регистратуре или на приёме — цена
                зависит от объёма лечения и применяемых материалов.
              </p>
              <div className="mt-4 flex flex-col gap-2 text-sm">
                <Link href="/appointment" className="font-medium text-primary">
                  → Записаться на консультацию
                </Link>
                <Link href="/documents" className="font-medium text-primary">
                  → Раздел «Документы»
                </Link>
              </div>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section>
        <Reveal>
          <Notice>
            Часть медицинской помощи оказывается бесплатно в рамках
            территориальной программы ОМС. Условия получения бюджетной
            стоматологической помощи и список необходимых документов —{" "}
            <Link href="/patients" className="font-medium text-primary">
              в разделе «Пациентам»
            </Link>
            .
          </Notice>
        </Reveal>
      </Section>
    </>
  );
}
