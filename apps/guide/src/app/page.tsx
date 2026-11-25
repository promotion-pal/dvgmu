import { appConfig } from "@/shared/config/app";
import { Badge } from "@/shared/ui/badge";
import { buttonVariants } from "@/shared/ui/button";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  GraduationCap,
  Mail,
  MapPin,
  Megaphone,
  Phone,
  ShieldCheck,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";

export default function Home() {
  const { enrollment, contacts, company } = appConfig;

  return (
    <div className="flex flex-col flex-1">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#" className="flex items-center gap-2 font-semibold">
            <Image
              src="/icon.png"
              alt={company.shortName}
              width={32}
              height={32}
              className="size-8 rounded-full"
            />
            <span>{company.shortName}</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#schedule" className="transition-colors hover:text-foreground">
              Оргсобрания
            </a>
            <a href="#dormitory" className="transition-colors hover:text-foreground">
              Общежитие
            </a>
            <a href="#checklist" className="transition-colors hover:text-foreground">
              Документы
            </a>
            <a href="#contacts" className="transition-colors hover:text-foreground">
              Контакты
            </a>
          </nav>

          <a
            href={enrollment.pdfUrl}
            download
            className={buttonVariants({ size: "lg", className: "rounded-full" })}
          >
            Скачать PDF
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-144 w-xl -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-0 top-40 h-64 w-64 rounded-full bg-accent blur-3xl" />
          </div>

          <div className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center sm:pt-28">
            <p className="font-serif text-lg italic text-muted-foreground">
              Первый шаг к профессии врача.
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Внимание,
              <br />
              первокурсники!
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground text-balance">
              Поздравляем с зачислением в ДВГМУ — первый медицинский
              университет на Дальнем Востоке! Чтобы хорошо подготовиться к
              началу учебного года {enrollment.academicYear}, соберите всё
              необходимое до 1 сентября.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href={enrollment.pdfUrl}
                download
                className={buttonVariants({ size: "lg", className: "rounded-full px-6" })}
              >
                <Download />
                Скачать памятку PDF
              </a>
              <a
                href="#schedule"
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "rounded-full px-6",
                })}
              >
                Все оргсобрания
                <ArrowRight />
              </a>
            </div>
          </div>

          <div className="mx-auto max-w-4xl px-6 pb-24">
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3">
              <div className="flex flex-col items-center gap-2 bg-card px-6 py-8 text-center">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-chart-1/10 text-chart-1">
                  <Calendar className="size-5" />
                </span>
                <p className="text-sm text-muted-foreground">Оргсобрания</p>
                <p className="text-lg font-semibold">28–31 августа</p>
              </div>
              <div className="flex flex-col items-center gap-2 bg-card px-6 py-8 text-center">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-chart-3/10 text-chart-3">
                  <MapPin className="size-5" />
                </span>
                <p className="text-sm text-muted-foreground">Место проведения</p>
                <p className="text-lg font-semibold">Актовый зал</p>
              </div>
              <div className="flex flex-col items-center gap-2 bg-card px-6 py-8 text-center">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-chart-2/10 text-chart-2">
                  <Wallet className="size-5" />
                </span>
                <p className="text-sm text-muted-foreground">Платное обучение до</p>
                <p className="text-lg font-semibold">{enrollment.paymentDeadline}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section id="schedule" className="border-t border-border py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <Badge className="bg-chart-1 text-primary-foreground">
                  <GraduationCap /> По факультетам
                </Badge>
                <h2 className="mt-4 max-w-lg text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  Графики оргсобраний и получения{" "}
                  <span className="font-serif italic">учебной литературы</span>
                </h2>
              </div>
              <p className="max-w-sm text-muted-foreground">
                Явка обязательна: вы познакомитесь с деканом, узнаете свою
                группу, старосту и получите пропускную карту в университет.
              </p>
            </div>

            <div className="mt-10 overflow-hidden rounded-2xl border border-border">
              <div className="hidden grid-cols-[1.6fr_0.8fr_0.6fr_0.8fr_0.8fr] gap-4 bg-muted px-6 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
                <span>Факультет</span>
                <span>Дата</span>
                <span>Время</span>
                <span>Место</span>
                <span>Литература</span>
              </div>
              <div className="divide-y divide-border">
                {enrollment.faculties.map((faculty) => (
                  <div
                    key={faculty.name}
                    className="grid grid-cols-1 gap-2 bg-card px-6 py-5 transition-colors hover:bg-muted/50 md:grid-cols-[1.6fr_0.8fr_0.6fr_0.8fr_0.8fr] md:items-center md:gap-4"
                  >
                    <div>
                      <p className="font-medium">{faculty.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {faculty.specialties}
                      </p>
                      {faculty.dean && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Декан: {faculty.dean}
                          {faculty.phone && (
                            <>
                              {" · "}
                              <a
                                href={faculty.phone.link}
                                className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                              >
                                <Phone className="size-3" />
                                {faculty.phone.label}
                              </a>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm md:block">
                      <Calendar className="size-4 text-muted-foreground md:hidden" />
                      {faculty.date}
                    </div>
                    <div className="flex items-center gap-2 text-sm md:block">
                      <Clock className="size-4 text-muted-foreground md:hidden" />
                      {faculty.time}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground md:block">
                      <MapPin className="size-4 text-muted-foreground md:hidden" />
                      {faculty.place}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground md:block">
                      <BookOpen className="size-4 text-muted-foreground md:hidden" />
                      {faculty.literatureTime}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dormitory */}
        <section id="dormitory" className="scroll-mt-20 border-t border-border bg-muted/40 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <Badge className="bg-chart-3 text-primary-foreground">
              <Building2 /> Общежитие
            </Badge>
            <h2 className="mt-4 max-w-lg text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Регистрация и{" "}
              <span className="font-serif italic">заселение</span>
            </h2>

            <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-chart-3/10 text-chart-3">
                    <MapPin className="size-4" />
                  </span>
                  <p className="font-semibold">С чего начать</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {enrollment.dormitory.registrationPlace}, {enrollment.dormitory.registrationAddress} —
                  после {enrollment.dormitory.registrationFrom}.{" "}
                  {enrollment.dormitory.registrationNote}
                </p>

                <div className="mt-6 flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-chart-3/10 text-chart-3">
                    <Stethoscope className="size-4" />
                  </span>
                  <p className="font-semibold">Обязательный медосмотр</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Пройти заранее в консультативно-диагностической
                  поликлинике ДВГМУ: {enrollment.dormitory.clinicAddress}.
                  Приём {enrollment.dormitory.clinicHours}.{" "}
                  {enrollment.dormitory.resultNote}
                </p>

                <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" />
                    <span>Справка о медосмотре — {enrollment.dormitory.certificateCost}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" />
                    <span>{enrollment.dormitory.photosRequired}</span>
                  </li>
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="font-semibold">
                  Документы для регистратуры поликлиники
                </p>
                <ul className="mt-4 space-y-3">
                  {enrollment.dormitory.documents.map((doc) => (
                    <li key={doc} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" />
                      <span className="text-muted-foreground">{doc}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  Допускается справка № 086/у или СЭМД (196) с отметкой о
                  флюорографии и результатами анализа на RW.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Checklist */}
        <section id="checklist" className="border-t border-border py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.3fr_1fr] sm:items-start">
              <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Возьмите с собой на{" "}
                <span className="font-serif italic">оргсобрание</span>
              </h2>
              <p className="text-muted-foreground">
                После оргсобрания в библиотеке вам выдадут обязательную
                учебную литературу — учебники и пособия.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {enrollment.checklist.map((item) => (
                <div key={item.title}>
                  <div className="relative aspect-4/5 overflow-hidden rounded-2xl border border-border bg-muted">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      sizes="(min-width: 640px) 33vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  <h3 className="mt-4 font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-12">
              <h3 className="font-semibold">Оплата обучения</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Порядок зависит от формы обучения — бюджет или контракт.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-chart-3/10 text-chart-3">
                      <CheckCircle2 className="size-5" />
                    </span>
                    <p className="font-semibold">Бюджетное обучение</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {enrollment.payment.budget}
                  </p>
                </div>

                <div className="rounded-2xl border border-accent bg-accent/10 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Wallet className="size-5" />
                      </span>
                      <p className="min-w-0 font-semibold">Платное обучение (контракт)</p>
                    </div>
                    <Badge className="shrink-0 bg-accent text-accent-foreground">
                      До {enrollment.paymentDeadline}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {enrollment.payment.contract}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {enrollment.payment.contractNote}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Military / target quota / schedule */}
        <section className="border-t border-border bg-muted/40 py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-chart-4/10 text-chart-4">
                  <ShieldCheck className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">Военнообязанные</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {enrollment.military}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-chart-5/10 text-chart-5">
                  <Users className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">Целевая квота</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {enrollment.targetQuota}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-chart-1/10 text-chart-1">
                  <Calendar className="size-5" />
                </span>
                <h3 className="mt-4 font-semibold">Расписание занятий</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Смотрите на сайте университета в разделе «Учёба —
                  Расписания занятий». Корпуса, кафедры и аудитории вы
                  узнаете на оргсобрании.
                </p>
                <a
                  href={enrollment.scheduleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  fesmu.ru
                  <ArrowRight className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* News channels */}
        <section className="border-t border-border bg-accent/10 py-14">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Megaphone className="size-5" />
            </span>
            <h3 className="mt-4 text-xl font-semibold">
              Следите за новостями и объявлениями
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Актуальная информация публикуется на сайте университета, в MAX
              и на странице ДВГМУ ВКонтакте.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {enrollment.channels.map((channel) => (
                <a key={channel.label} href={channel.link} target="_blank" rel="noopener noreferrer">
                  <Badge variant="outline" className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground">
                    {channel.label}
                  </Badge>
                </a>
              ))}
              <a
                href={enrollment.pdfUrl}
                download
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                QR-коды — в памятке PDF
              </a>
            </div>
          </div>
        </section>

        {/* CTA banner */}
        <section id="contacts" className="relative overflow-hidden border-t border-border bg-primary text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-40">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
            <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-primary-foreground/10 blur-3xl" />
          </div>

          <div className="mx-auto max-w-4xl px-6 py-20 text-center sm:py-28">
            <p className="font-serif text-lg italic opacity-70">
              Мы вас ждём.
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-5xl">
              До встречи на организационных собраниях!
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-primary-foreground/70 text-balance">
              Желаем успехов в учёбе, интереса и тяги к знаниям на всём
              пути к диплому врача.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4 text-sm">
              {contacts.phones.map((phone) => (
                <a
                  key={phone.link}
                  href={phone.link}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 px-5 py-2.5 transition-colors hover:bg-primary-foreground/10"
                >
                  <Phone className="size-4" />
                  {phone.label}
                </a>
              ))}
              {contacts.emails.map((email) => (
                <a
                  key={email.link}
                  href={email.link}
                  className="inline-flex items-center gap-2 rounded-full border border-primary-foreground/20 px-5 py-2.5 transition-colors hover:bg-primary-foreground/10"
                >
                  <Mail className="size-4" />
                  {email.label}
                </a>
              ))}
            </div>

            <p className="mt-6 text-sm text-primary-foreground/60">
              {contacts.addresses.join(", ")} · {contacts.schedule}
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-muted-foreground">
          {appConfig.footer.copyright}
        </div>
      </footer>

      <a
        href="#dormitory"
        aria-label="Перейти к информации о заселении"
        className={buttonVariants({
          size: "lg",
          className:
            "fixed bottom-5 right-5 z-50 h-auto rounded-full px-5 py-3 shadow-lg shadow-black/15 sm:bottom-6 sm:right-6",
        })}
      >
        <Building2 />
        Заселение
      </a>
    </div>
  );
}
