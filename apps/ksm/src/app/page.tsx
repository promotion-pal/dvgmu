import Link from "next/link";
import {
  Activity,
  ArrowRight,
  GraduationCap,
  HeartPulse,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { appConfig } from "@/shared/config/app";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, SectionTitle, LinkCard } from "@/shared/components/ui-bits";
import { services } from "@/shared/data/services";
import { newsSorted, formatDate } from "@/shared/data/news";

const facts = [
  {
    icon: GraduationCap,
    title: "Подразделение ДВГМУ",
    text: "Структурное подразделение Дальневосточного государственного медицинского университета Минздрава России.",
  },
  {
    icon: HeartPulse,
    title: "Принцип семейной медицины",
    text: "Консультативно-диагностическая помощь строится по принципу семейной медицины — наблюдение всей семьи.",
  },
  {
    icon: ShieldCheck,
    title: "Лицензия и законодательство РФ",
    text: `Медицинская деятельность ведётся на основании лицензии ${appConfig.license} в соответствии с законодательством РФ.`,
  },
];

export default function HomePage() {
  const mainPhone = appConfig.phones[0].number;

  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-linear-to-b from-primary/10 to-transparent">
        <div className="container mx-auto px-4 py-16 text-center md:py-24">
          <Reveal
            as="span"
            className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
          >
            Консультативно-диагностическая поликлиника ДВГМУ · с 1996 года
          </Reveal>
          <Reveal
            as="h1"
            delay={0.05}
            className="mx-auto mt-5 max-w-4xl text-3xl font-bold text-balance break-words hyphens-auto sm:text-4xl md:text-5xl"
          >
            {appConfig.fullName}
          </Reveal>
          <Reveal
            as="p"
            delay={0.1}
            className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground"
          >
            {appConfig.tagline} Помощь оказывается по программе ОМС, по договорам
            ДМС и на платной основе.
          </Reveal>
          <Reveal delay={0.15} className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/appointment"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            >
              Записаться на приём
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 font-medium transition-colors hover:bg-muted"
            >
              Все услуги
            </Link>
          </Reveal>
          <Reveal
            delay={0.2}
            className="mt-8 flex flex-wrap justify-center gap-3 text-sm"
          >
            {["ОМС", "ДМС", "Платные услуги"].map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-4 py-2 font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {facts.map((f) => (
            <RevealItem
              key={f.title}
              className="rounded-xl border border-border bg-card p-6 text-center shadow-sm"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <f.icon className="h-7 w-7 text-primary" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      <Section muted>
        <Reveal>
          <SectionTitle center>Направления помощи</SectionTitle>
        </Reveal>
        <RevealGroup className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.slice(0, 6).map((s) => (
            <RevealItem key={s.slug}>
              <Link
                href={`/services#${s.slug}`}
                className="group flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <Activity className="h-9 w-9 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{s.name}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.short}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Подробнее
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
        <Reveal className="mt-8 text-center">
          <Link
            href="/services"
            className="inline-flex items-center gap-2 rounded-full border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Все направления и прейскурант
          </Link>
        </Reveal>
      </Section>

      <Section>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <SectionTitle>О клинике</SectionTitle>
            <p className="mt-4 text-muted-foreground">
              «Клиника семейной медицины» основана в {appConfig.founded.year} году
              ({appConfig.founded.order}) как консультативно-диагностическая
              поликлиника Дальневосточного государственного медицинского
              университета. Медицинская помощь оказывается по принципу семейной
              медицины на основании лицензии и в соответствии с законодательством
              РФ.
            </p>
            <p className="mt-4 text-muted-foreground">
              Главный врач — {appConfig.chief.name}.
            </p>
            <Link
              href="/about"
              className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary"
            >
              Сведения о медицинской организации
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Reveal>
          <Reveal
            delay={0.1}
            className="flex h-72 items-center justify-center rounded-xl bg-primary/10 md:h-80"
          >
            <div className="p-6 text-center">
              <Stethoscope className="mx-auto h-14 w-14 text-primary" />
              <p className="mt-4 text-xl font-bold">{appConfig.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Клиника федерального подчинения · {appConfig.address.city}
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section muted>
        <Reveal>
          <SectionTitle center>Новости клиники</SectionTitle>
        </Reveal>
        <RevealGroup className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {newsSorted.slice(0, 3).map((n) => (
            <RevealItem key={n.slug}>
              <Link
                href={`/news/${n.slug}`}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <span className="text-sm font-medium text-primary">
                  {formatDate(n.date)}
                </span>
                <h3 className="mt-2 font-semibold">{n.title}</h3>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                  {n.summary}
                </p>
              </Link>
            </RevealItem>
          ))}
        </RevealGroup>
        <Reveal className="mt-8 text-center">
          <Link
            href="/news"
            className="inline-flex items-center gap-2 rounded-full border border-primary px-6 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Все новости
          </Link>
        </Reveal>
      </Section>

      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/programs",
              title: "Комплексные программы",
              description:
                "Боль в спине, радиоволновая хирургия, диагностика зрения, экспресс-лаборатория «Цито».",
            },
            {
              href: "/patients",
              title: "Пациентам",
              description:
                "Права и обязанности, диспансеризация, страховые организации, что взять на приём.",
            },
            {
              href: "/patients/faq",
              title: "Вопрос-ответ",
              description: "Ответы на частые вопросы пациентов клиники.",
            },
            {
              href: "/doctors",
              title: "Врачи",
              description: "Медицинские работники поликлиники и их квалификация.",
            },
            {
              href: "/oversight",
              title: "Контролирующие органы",
              description:
                "Минздрав РФ и края, ТФОМС, Росздравнадзор, Роспотребнадзор.",
            },
            {
              href: "/contacts",
              title: "Контакты и схема проезда",
              description: `${appConfig.address.short}, ${appConfig.address.city}. Запись: ${mainPhone}.`,
            },
          ].map((c) => (
            <RevealItem key={c.href}>
              <LinkCard {...c} />
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>
    </>
  );
}
