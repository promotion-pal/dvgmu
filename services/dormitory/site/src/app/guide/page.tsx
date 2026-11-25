import Link from "next/link";

export const metadata = {
  title: "Как заполнить форму записи на дежурство",
};

const steps = [
  {
    title: "Фамилия, имя, отчество",
    text: "Как в паспорте. Отчество можно не указывать, если его нет.",
  },
  {
    title: "Телефон",
    text: "10 цифр номера. Префикс +7 подставится сам — просто наберите номер (900...). По нему с вами свяжутся по вопросам дежурства.",
  },
  {
    title: "Номер зачётной книжки",
    text: "7 цифр. По первым двум определяется факультет — вводить факультет отдельно не нужно.",
  },
  {
    title: "Группа",
    text: "Номер вашей учебной группы (например 309). Первая цифра — курс: 309 → 3 курс. От курса зависит, в какое время суток открыта запись (см. ниже).",
  },
  {
    title: "Комната",
    text: "Номер комнаты в общежитии. Этаж — это номер без последних двух цифр: 305 → 3 этаж, 1014 → 10 этаж, 1104 → 11 этаж. График дежурств ведётся по этажам.",
  },
  {
    title: "Согласие на обработку данных",
    text: "Поставьте галочку. Данные используются только для графика дежурств и никуда не передаются.",
  },
  {
    title: "Дата дежурства",
    text: "Календарь откроется только после того, как все поля выше заполнены правильно. В нём доступен один месяц — следующий. Числа, которые на вашем этаже уже заняты, зачёркнуты — выберите любое свободное.",
  },
  {
    title: "Кнопка «Записаться на дежурство»",
    text: "Станет активной, когда всё заполнено и дата выбрана. После нажатия появится подтверждение.",
  },
];

export default function Guide() {
  return (
    <main className="flex-1 bg-background">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 text-sm leading-relaxed sm:py-12">
        <header>
          <h1 className="h1">Как заполнить форму</h1>
          <p className="mt-1 text-muted-foreground">
            Пошагово — что вводить в каждое поле
          </p>
        </header>

        <ol className="flex flex-col gap-4">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="text-muted-foreground">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="flex flex-col gap-2 rounded-md border p-4">
          <h2 className="h3">Когда можно записаться</h2>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>Записаться можно в любое время суток</li>
          </ul>
          <p className="text-muted-foreground">
            Дежурство всегда назначается на следующий месяц. Одна запись на
            человека в месяц. На каждый этаж — один дежурный в день.
          </p>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/"
            className="text-primary underline-offset-4 hover:underline"
          >
            ← К форме записи
          </Link>
          <Link
            href="/privacy"
            className="text-primary underline-offset-4 hover:underline"
          >
            Политика обработки данных
          </Link>
        </div>
      </article>
    </main>
  );
}
