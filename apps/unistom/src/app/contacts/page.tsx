import type { Metadata } from "next";
import { Bus, Clock, Mail, MapPin, Phone, User } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal } from "@/shared/components/reveal";
import { Section, Card } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";

export const metadata: Metadata = {
  title: "Контактная информация",
  description:
    "Адрес, телефоны, электронная почта, часы работы и схема проезда стоматологической поликлиники «Уни-Стом»: Хабаровск, ул. Муравьёва-Амурского, 30.",
};

const mapUrl = `https://yandex.ru/maps/?pt=${appConfig.coords.lng},${appConfig.coords.lat}&z=17&l=map`;

export default function ContactsPage() {
  const { phones, transport, schedule } = appConfig;
  return (
    <>
      <PageHeader
        title="Контактная информация"
        crumbs={[{ title: "Контакты" }]}
      />

      <Section>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <Reveal className="space-y-6">
            <Card>
              <h2 className="flex items-center gap-2 font-semibold">
                <MapPin className="h-4 w-4 text-primary" /> Адрес
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {appConfig.address.full}
              </p>
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-primary"
              >
                Открыть на карте →
              </a>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-semibold">
                <Phone className="h-4 w-4 text-primary" /> Телефоны
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <li>
                  Регистратура:{" "}
                  {phones.registry.map((p, i) => (
                    <span key={p}>
                      {i > 0 && ", "}
                      <a
                        href={`tel:${p.replace(/[^\d+]/g, "")}`}
                        className="font-medium text-primary"
                      >
                        {p}
                      </a>
                    </span>
                  ))}
                </li>
                <li>Приёмная: {phones.reception}</li>
                <li>Главный врач: {phones.chief}</li>
              </ul>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-semibold">
                <Mail className="h-4 w-4 text-primary" /> Электронная почта
              </h2>
              <p className="mt-2 text-sm">
                <a
                  href={`mailto:${appConfig.email}`}
                  className="font-medium text-primary"
                >
                  {appConfig.email}
                </a>
              </p>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-semibold">
                <Clock className="h-4 w-4 text-primary" /> Часы работы
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>{schedule.weekdays}</li>
                <li>{schedule.saturday}</li>
                <li>{schedule.sunday}</li>
              </ul>
            </Card>

            <Card>
              <h2 className="flex items-center gap-2 font-semibold">
                <User className="h-4 w-4 text-primary" /> Руководитель
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {appConfig.chief.position}
              </p>
              <p className="text-sm font-medium">{appConfig.chief.name}</p>
            </Card>
          </Reveal>

          <Reveal delay={0.1} className="space-y-6">
            <div className="flex h-72 items-center justify-center rounded-xl border border-border bg-muted text-center">
              <div className="p-6">
                <MapPin className="mx-auto h-10 w-10 text-primary" />
                <p className="mt-3 text-sm font-medium">
                  {appConfig.address.street}
                </p>
                <p className="text-sm text-muted-foreground">
                  {appConfig.address.city}
                </p>
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block rounded-full border border-primary px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  Построить маршрут
                </a>
              </div>
            </div>

            <Card>
              <h2 className="flex items-center gap-2 font-semibold">
                <Bus className="h-4 w-4 text-primary" /> Как добраться
              </h2>
              <dl className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div>
                  <dt className="font-medium text-foreground">Автобусы</dt>
                  <dd>{transport.bus.join(", ")}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Троллейбусы</dt>
                  <dd>{transport.trolleybus.join(", ")}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">
                    Маршрутные такси
                  </dt>
                  <dd>{transport.minibus.join(", ")}</dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">Остановки</dt>
                  <dd>{transport.stops.join(", ")}</dd>
                </div>
              </dl>
            </Card>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
