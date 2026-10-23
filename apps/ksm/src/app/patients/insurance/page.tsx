import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Section, SectionTitle, Card, Notice } from "@/shared/components/ui-bits";
import { omsInsurer, omsNote, dmsInsurers } from "@/shared/data/insurance";

export const metadata: Metadata = {
  title: "Страховые организации",
  description:
    "Страховые медицинские организации (ОМС) и страховые компании (ДМС), с которыми у «Клиники семейной медицины» заключены договоры на оказание и оплату медицинской помощи.",
};

export default function InsurancePage() {
  return (
    <>
      <PageHeader
        title="Страховые организации"
        intro="Договоры на оказание и оплату медицинской помощи по ОМС и ДМС."
        crumbs={[
          { title: "Пациентам", href: "/patients" },
          { title: "Страховые организации" },
        ]}
      />

      <Section>
        <SectionTitle>Обязательное медицинское страхование (ОМС)</SectionTitle>
        <Card className="mt-6 max-w-2xl">
          <p className="text-lg font-semibold">{omsInsurer.name}</p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>Реестровый номер: {omsInsurer.registry}</li>
            <li>Адрес: {omsInsurer.address}</li>
            <li>Лицензия: {omsInsurer.license}</li>
            <li>{omsInsurer.head}</li>
            <li>Телефоны: {omsInsurer.phones.join(", ")}</li>
          </ul>
        </Card>
        <div className="mt-6 max-w-2xl">
          <Notice>{omsNote}</Notice>
        </div>
      </Section>

      <Section muted>
        <SectionTitle>Добровольное медицинское страхование (ДМС)</SectionTitle>
        <p className="mt-3 text-sm text-muted-foreground">
          Клиника работает с компаниями добровольного медицинского страхования:
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {dmsInsurers.map((i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{i}</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted-foreground">
          Перечень страховых компаний может изменяться. Возможность обслуживания
          по конкретному полису ДМС уточняйте у администратора для страховых
          компаний: 8 (4212) 31-68-30.
        </p>
      </Section>
    </>
  );
}
