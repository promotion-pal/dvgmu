import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Section, Notice } from "@/shared/components/ui-bits";
import { oversight } from "@/shared/data/oversight";

export const metadata: Metadata = {
  title: "Контролирующие органы",
  description:
    "Контакты органов государственной власти и контролирующих органов в сфере охраны здоровья: Минздрав РФ, Минздрав Хабаровского края, ТФОМС, Росздравнадзор, Роспотребнадзор.",
};

export default function OversightPage() {
  return (
    <>
      <PageHeader
        title="Контролирующие органы"
        intro="Органы государственной власти и организации, осуществляющие контроль в сфере охраны здоровья."
        crumbs={[{ title: "Контролирующие органы" }]}
      />

      <Section>
        <div className="space-y-5">
          {oversight.map((o) => (
            <div
              key={o.name}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <h2 className="font-semibold">{o.name}</h2>
              {o.head && (
                <p className="mt-1 text-sm text-muted-foreground">{o.head}</p>
              )}
              <p className="mt-3 text-sm text-muted-foreground">{o.address}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {o.phones.join(" · ")}
              </p>
              {o.extra && (
                <p className="mt-2 text-xs text-muted-foreground">{o.extra}</p>
              )}
            </div>
          ))}
        </div>
        <div className="mt-8 max-w-3xl">
          <Notice>
            Обращение к руководству клиники: приёмная главного врача
            8 (4212) 30-34-74, электронная почта fmc@mail.fesmu.ru. Претензии по
            качеству медицинской помощи вы также можете направить в свою страховую
            медицинскую организацию.
          </Notice>
        </div>
      </Section>
    </>
  );
}
