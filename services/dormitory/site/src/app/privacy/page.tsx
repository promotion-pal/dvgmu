import Link from "next/link";

import { appConfig } from "@/shared/config/app";

export const metadata = {
  title: "Политика обработки персональных данных",
};

export default function Privacy() {
  return (
    <main className="flex-1 bg-background">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 text-sm leading-relaxed sm:py-12">
        <header>
          <h1 className="h1">Политика обработки персональных данных</h1>
          <p className="mt-1 text-muted-foreground">
            Сервис записи на дежурство в общежитии № 2 {appConfig.company.shortName}
          </p>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="h3">1. Какие данные собираются</h2>
          <p>
            При записи на дежурство сохраняются: фамилия, имя, отчество, номер
            телефона, номер зачётной книжки, номер учебной группы, номер комнаты
            и выбранная дата дежурства.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="h3">2. Зачем они нужны</h2>
          <p>
            Единственная цель обработки — формирование графика дежурств по этажам
            и связь со студентом по вопросам дежурства. Данные не используются для
            рекламы, аналитики и любых иных целей.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="h3">3. Кому передаются</h2>
          <p>
            Данные <strong>никуда не передаются</strong>. Доступ к ним имеют
            только уполномоченные сотрудники студенческого совета общежития.
            Данные не публикуются и не предоставляются третьим лицам.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="h3">4. Хранение</h2>
          <p>
            Данные хранятся на сервере университета в течение учебного года и
            удаляются по его завершении либо по запросу студента.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="h3">5. Права студента</h2>
          <p>
            Вы можете отозвать согласие, запросить исправление или удаление своих
            данных, обратившись в студенческий совет общежития или по контактам{" "}
            {appConfig.company.shortName}: {appConfig.contacts.phones[0]?.label},{" "}
            {appConfig.contacts.emails[0]?.label}.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="h3">6. Согласие</h2>
          <p>
            Отправляя форму записи на дежурство и отмечая соответствующий чекбокс,
            вы подтверждаете, что ознакомлены с настоящей политикой и даёте
            согласие на обработку перечисленных данных на указанных условиях.
          </p>
        </section>

        <Link
          href="/"
          className="text-primary underline-offset-4 hover:underline"
        >
          ← Вернуться к форме записи
        </Link>
      </article>
    </main>
  );
}
