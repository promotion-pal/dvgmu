import Link from "next/link";
import {
  ArrowRight,
  Award,
  GraduationCap,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { FaTeethOpen } from "react-icons/fa";
import { appConfig } from "@/shared/config/app";
import { Reveal, RevealGroup, RevealItem } from "@/shared/components/reveal";
import { Section, SectionTitle, LinkCard } from "@/shared/components/ui-bits";
import { services } from "@/shared/data/services";
import { news } from "@/shared/data/news";

const departments = [
  "Кафедра ортопедической стоматологии",
  "Кафедра стоматологии детского возраста",
  "Кафедра терапевтической стоматологии",
  "Кафедра хирургической стоматологии и челюстно-лицевой хирургии",
];

const advantages = [
  {
    icon: GraduationCap,
    title: "Профессорско-преподавательский состав",
    text: "Приём и консультации ведут профессора, доктора и кандидаты медицинских наук.",
  },
  {
    icon: ShieldCheck,
    title: "Государственные гарантии",
    text: "Помощь по программе ОМС Хабаровского края, ДМС и на платной основе.",
  },
  {
    icon: Award,
    title: "Учебная и научная база ДВГМУ",
    text: "Клиническая база стоматологического факультета, современные методики.",
  },
  {
    icon: Users,
    title: "Комплексный подход",
    text: "Консультация по любому разделу стоматологии в одном месте.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-linear-to-b from-primary/10 to-transparent">
        <div className="container mx-auto px-4 py-16 text-center md:py-24">
          <Reveal
            as="span"
            className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary"
          >
            Более 20 лет опыта · клиническая база ДВГМУ
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
            {appConfig.tagline} Стоматологическую помощь оказывают
            профессорско-преподавательский состав, доктора и кандидаты
            медицинских наук.
          </Reveal>
          <Reveal
            delay={0.15}
            className="mt-8 flex flex-wrap justify-center gap-3"
          >
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

      {/* Преимущества */}
      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map((a) => (
            <RevealItem
              key={a.title}
              className="rounded-xl border border-border bg-card p-6 text-center shadow-sm"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <a.icon className="h-7 w-7 text-primary" />
              </span>
              <h3 className="mt-4 font-semibold">{a.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{a.text}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Section>

      {/* Услуги */}
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
                <FaTeethOpen className="h-10 w-10 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{s.name}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">
                  {s.short}
                </p>
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
            Все услуги и прейскурант
          </Link>
        </Reveal>
      </Section>

      {/* О поликлинике */}
      <Section>
        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal>
            <SectionTitle>О поликлинике</SectionTitle>
            <p className="mt-4 text-muted-foreground">
              {appConfig.fullName} — это учебный, научный и лечебный комплекс,
              клиническая база стоматологического факультета. Финансирование
              осуществляется за счёт средств ОМС, приносящей доход деятельности,
              добровольного медицинского страхования и средств предприятий.
            </p>
            <h3 className="mt-6 font-semibold">
              Кафедры, базирующиеся в поликлинике
            </h3>
            <ul className="mt-3 space-y-2">
              {departments.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
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
                Клиника федерального подчинения
              </p>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* Новости */}
      <Section muted>
        <Reveal>
          <SectionTitle center>Новости поликлиники</SectionTitle>
        </Reveal>
        <RevealGroup className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {news.slice(0, 3).map((n) => (
            <RevealItem key={n.slug}>
              <Link
                href={`/news#${n.slug}`}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <span className="text-sm font-medium text-primary">
                  {n.date}
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

      {/* Быстрые ссылки */}
      <Section>
        <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/patients",
              title: "Пациентам",
              description:
                "Бюджетная помощь, права и обязанности, график работы врачей, документы для записи.",
            },
            {
              href: "/patients/faq",
              title: "Вопрос-ответ",
              description: "Ответы врачей на частые вопросы пациентов.",
            },
            {
              href: "/doctors",
              title: "Врачи",
              description: "Сведения о медицинских работниках организации.",
            },
            {
              href: "/oversight",
              title: "Контролирующие органы",
              description:
                "Росздравнадзор, Роспотребнадзор, Минздрав края, ТФОМС, страховая компания.",
            },
            {
              href: "/documents",
              title: "Документы",
              description: "Лицензия, устав, нормативные акты, прейскурант.",
            },
            {
              href: "/contacts",
              title: "Контакты и схема проезда",
              description: `${appConfig.address.street}, ${appConfig.address.city}.`,
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
