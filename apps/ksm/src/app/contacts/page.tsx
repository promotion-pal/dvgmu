import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, Phone, Send } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section, SectionTitle, Card } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Контакты",
  description:
    "Адрес, телефоны регистратуры, электронная почта и режим работы «Клиники семейной медицины» ДВГМУ. Хабаровск, ул. Карла Маркса, 60.",
};

const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        title="Контакты"
        intro={`${appConfig.address.full} · ${appConfig.address.landmark}`}
        crumbs={[{ title: "Контакты" }]}
      />

      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Адрес</p>
                <p className="text-muted-foreground">{appConfig.address.full}</p>
                <p className="text-sm text-muted-foreground">{appConfig.address.landmark}</p>
                <a
                  href={appConfig.map2gis}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary"
                >
                  Открыть на карте 2ГИС
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Электронная почта</p>
                <a href={`mailto:${appConfig.email}`} className="text-muted-foreground">
                  {appConfig.email}
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Send className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Telegram</p>
                <a
                  href={appConfig.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground"
                >
                  Присоединиться к чату клиники
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Режим работы</p>
                <ul className="text-muted-foreground">
                  {appConfig.schedule.map((s) => (
                    <li key={s.day}>
                      {s.day}: {s.hours}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Link
              href="/appointment"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            >
              <Phone className="h-4 w-4" />
              Записаться на приём
            </Link>
          </div>

          <div>
            <SectionTitle>Телефоны</SectionTitle>
            <div className="mt-6 space-y-3">
              {appConfig.phones.map((p) => (
                <a
                  key={p.number}
                  href={tel(p.number)}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted"
                >
                  <div>
                    <p className="font-semibold">{p.number}</p>
                    <p className="text-sm text-muted-foreground">{p.label}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </Section>

      <Section muted>
        <SectionTitle>Как добраться</SectionTitle>
        <Card className="mt-6 max-w-2xl">
          <p className="text-sm text-muted-foreground">
            Клиника расположена в центре Хабаровска на ул. Карла Маркса, 60.
            Ближайшая остановка общественного транспорта — «Площадь Ленина».
            Координаты для навигатора: {appConfig.coords.lat}, {appConfig.coords.lng}.
          </p>
        </Card>
      </Section>
    </>
  );
}
