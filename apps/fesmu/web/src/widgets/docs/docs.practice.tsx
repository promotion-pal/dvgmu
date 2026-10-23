import { CalendarIcon, InfoIcon, ClockIcon, HospitalIcon, StethoscopeIcon, UserRoundIcon } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DocFiles, DocLink, DocLinks } from "./docs.blocks";
import type { DocCategory, DocEntry, DocSource } from "./docs.data";

/** Файлы раздела лежат в `docs/files/practice/` (см. IMAGES.md). */
const file = (name: string) => `/docs/files/practice/${name}`;

const REGULATION: DocSource = {
  href: file("polozhenie_o_praktike.pdf"),
  label: "Положение о практической подготовке обучающихся ДВГМУ (PDF)",
};

/** Общие бланки — нужны на любой практике. */
const COMMON_FILES: DocSource[] = [
  { href: file("zayavlenie_na_praktiku.docx"), label: "Заявление на прохождение практики (DOCX)" },
  { href: file("zayavka_profilnoy_organizacii.docx"), label: "Заявка профильной организации / гарантийное письмо (DOCX)" },
  { href: file("dogovor_s_bazoy.docx"), label: "Договор о практической подготовке с базой (DOCX)" },
  { href: file("napravlenie_na_praktiku.docx"), label: "Направление на практику (DOCX)" },
];

interface Practice {
  title: string;
  kind: "Учебная" | "Производственная";
  weeks: number;
  /** Где проходят. */
  base: string;
  files: DocSource[];
}

interface Course {
  n: number;
  period: string;
  practices: Practice[];
}

/** Практики по курсам для специальности «Лечебное дело» (31.05.01).
 * Другие специальности — по рабочему учебному плану своего факультета. */
const COURSES: Course[] = [
  {
    n: 1,
    period: "июнь – июль, после летней сессии",
    practices: [
      {
        title: "Ознакомительная практика: уход за больными терапевтического и хирургического профиля",
        kind: "Учебная",
        weeks: 2,
        base: "Клинические базы ДВГМУ, симуляционный центр",
        files: [
          { href: file("1/dnevnik.docx"), label: "Дневник практики (DOCX)" },
          { href: file("1/manipulyacii.docx"), label: "Перечень манипуляций и отчёт (DOCX)" },
          { href: file("1/harakteristika.docx"), label: "Характеристика обучающегося (DOCX)" },
        ],
      },
    ],
  },
  {
    n: 2,
    period: "июнь – июль, после летней сессии",
    practices: [
      {
        title: "Помощник младшего медицинского персонала",
        kind: "Производственная",
        weeks: 2,
        base: "Стационары медицинских организаций — баз практики",
        files: [
          { href: file("2/dnevnik.docx"), label: "Дневник практики (DOCX)" },
          { href: file("2/otchet.docx"), label: "Отчёт о практике (DOCX)" },
          { href: file("2/harakteristika.docx"), label: "Характеристика обучающегося (DOCX)" },
        ],
      },
    ],
  },
  {
    n: 3,
    period: "июнь – июль, после летней сессии",
    practices: [
      {
        title: "Помощник палатной медицинской сестры",
        kind: "Производственная",
        weeks: 2,
        base: "Терапевтические и хирургические отделения стационаров",
        files: [
          { href: file("3/dnevnik_palatnaya.docx"), label: "Дневник практики — палатная медсестра (DOCX)" },
          { href: file("3/otchet_palatnaya.docx"), label: "Отчёт о практике — палатная медсестра (DOCX)" },
        ],
      },
      {
        title: "Помощник процедурной медицинской сестры",
        kind: "Производственная",
        weeks: 2,
        base: "Процедурные кабинеты стационаров",
        files: [
          { href: file("3/dnevnik_procedurnaya.docx"), label: "Дневник практики — процедурная медсестра (DOCX)" },
          { href: file("3/otchet_procedurnaya.docx"), label: "Отчёт о практике — процедурная медсестра (DOCX)" },
          { href: file("3/harakteristika.docx"), label: "Характеристика обучающегося (DOCX)" },
        ],
      },
    ],
  },
  {
    n: 4,
    period: "июнь – июль, после летней сессии",
    practices: [
      {
        title: "Помощник врача стационара (терапия, хирургия, акушерство и гинекология)",
        kind: "Производственная",
        weeks: 4,
        base: "Профильные отделения стационаров",
        files: [
          { href: file("4/dnevnik.docx"), label: "Дневник практики (DOCX)" },
          { href: file("4/otchet.docx"), label: "Отчёт о практике (DOCX)" },
          { href: file("4/istoriya_bolezni.docx"), label: "Учебная история болезни — шаблон (DOCX)" },
          { href: file("4/harakteristika.docx"), label: "Характеристика обучающегося (DOCX)" },
        ],
      },
    ],
  },
  {
    n: 5,
    period: "июнь – июль, после летней сессии",
    practices: [
      {
        title: "Помощник врача амбулаторно-поликлинического учреждения",
        kind: "Производственная",
        weeks: 4,
        base: "Поликлиники и амбулатории, в том числе по месту жительства",
        files: [
          { href: file("5/dnevnik.docx"), label: "Дневник практики (DOCX)" },
          { href: file("5/otchet.docx"), label: "Отчёт о практике (DOCX)" },
          { href: file("5/harakteristika.docx"), label: "Характеристика обучающегося (DOCX)" },
        ],
      },
    ],
  },
  {
    n: 6,
    period: "в течение учебного года, по графику кафедр",
    practices: [
      {
        title: "Практика диагностического профиля и научно-исследовательская работа",
        kind: "Производственная",
        weeks: 4,
        base: "Клинические базы ДВГМУ, кафедры университета",
        files: [
          { href: file("6/dnevnik.docx"), label: "Дневник практики (DOCX)" },
          { href: file("6/otchet_nir.docx"), label: "Отчёт о НИР (DOCX)" },
          { href: file("6/harakteristika.docx"), label: "Характеристика обучающегося (DOCX)" },
        ],
      },
    ],
  },
];

const docLink = (id: string, text: string) => <DocLink id={id}>{text}</DocLink>;

const courseEntry = (course: Course): DocEntry => ({
  id: `practice-course-${course.n}`,
  title: `${course.n} курс`,
  summary: course.practices.map((p) => p.title).join("; "),
  content: (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          <CalendarIcon />
          {course.period}
        </Badge>
        <span className="text-muted-foreground">
          Точные даты — в приказе и {docLink("practice-announcements", "объявлениях")}.
        </span>
      </div>
      {course.practices.map((p) => (
        <section key={p.title} className="rounded-xl border p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold leading-snug">{p.title}</h3>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={p.kind === "Учебная" ? "outline" : "default"}>{p.kind}</Badge>
              <Badge variant="outline">
                <ClockIcon />
                {p.weeks} нед.
              </Badge>
              <Badge variant="outline" className="whitespace-normal h-auto">
                <HospitalIcon />
                {p.base}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
              Документы для скачивания
            </p>
            <DocFiles files={p.files} />
          </div>
        </section>
      ))}
      <h4 className="h4">Общие бланки</h4>
      <DocFiles files={COMMON_FILES} />
      <div className="wrapper-card flex items-start gap-3">
        <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        Заполненные дневник, отчёт и характеристику с подписью и печатью базы сдайте руководителю
        практики от кафедры до дня зачёта.
      </div>
    </>
  ),
});

export const PRACTICE_DOCS: DocCategory = {
  id: "practice",
  title: "Практика",
  icon: StethoscopeIcon,
  source: REGULATION,
  groups: [
    {
      title: "Общие вопросы",
      items: [
        {
          id: "practice",
          title: "Практика: с чего начать",
          summary: "Кто организует практику, куда обращаться, порядок действий",
          content: (
            <>
              <p>
                Практика — обязательная часть образовательной программы: без её зачёта нельзя
                перейти на следующий курс. Её организует <strong>отдел практики</strong>{" "}
                совместно с кафедрами и деканатами.
              </p>
              <div className="wrapper-card flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRoundIcon className="size-4" />
                </span>
                <div>
                  <p className="font-medium">Общие вопросы — отдел практики</p>
                  <p className="text-muted-foreground">
                    Ответственный — <strong className="text-foreground">Кисилев</strong>. По
                    вопросам конкретной практики — руководитель практики от кафедры.
                  </p>
                </div>
              </div>
              <h4 className="h4">Порядок действий</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Следите за {docLink("practice-announcements", "объявлениями")} о практике своего курса.</li>
                <li>
                  Выберите {docLink("practice-bases", "базу практики")}; для практики по месту
                  жительства — подайте {docLink("practice-application", "заявку")} в срок.
                </li>
                <li>Получите направление и пройдите инструктаж по охране труда.</li>
                <li>Пройдите практику, ведите дневник, выполните перечень манипуляций.</li>
                <li>Сдайте отчётные документы и получите зачёт с оценкой.</li>
              </ol>
              <h4 className="h4">Разделы</h4>
              <DocLinks
                ids={[
                  "practice-application",
                  "practice-announcements",
                  "practice-dates",
                  "practice-bases",
                  "practice-types",
                  "practice-rights",
                  "practice-regulation",
                ]}
              />
              <h4 className="h4">Документы по курсам</h4>
              <DocLinks ids={COURSES.map((c) => `practice-course-${c.n}`)} />
            </>
          ),
        },
        {
          id: "practice-application",
          title: "Форма заявки",
          summary: "Как подать заявку на практику, в том числе по месту жительства",
          content: (
            <>
              <p>
                По умолчанию студента распределяют на клиническую базу университета — заявка не
                нужна. Заявка подаётся, если вы хотите пройти практику{" "}
                <strong>в другой медицинской организации</strong>, например по месту жительства
                или по целевому договору.
              </p>
              <h4 className="h4">Что подать</h4>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Заявление на прохождение практики — на имя проректора, визирует декан.</li>
                <li>
                  Заявку (гарантийное письмо) профильной организации о согласии принять
                  студента, с подписью руководителя и печатью.
                </li>
                <li>
                  Договор о практической подготовке — если с организацией его ещё нет (список
                  действующих — в {docLink("practice-bases", "базах практики")}).
                </li>
              </ol>
              <p>
                Документы сдаются в отдел практики <strong>не позднее чем за месяц</strong> до
                начала практики. Опоздавших распределяют на базы университета.
              </p>
              <DocFiles files={COMMON_FILES} />
            </>
          ),
        },
        {
          id: "practice-announcements",
          title: "Публикация объявлений",
          summary: "Где и когда появляются распределение, сроки и собрания",
          content: (
            <>
              <p>Объявления о практике публикуются:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>на портале и в этом разделе документации;</li>
                <li>на сайте ДВГМУ, раздел «Практика»;</li>
                <li>на стендах деканатов и через старост групп.</li>
              </ul>
              <h4 className="h4">Что и когда публикуется</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>За 2 месяца</strong> — сроки практики и приём заявок на практику по
                  месту жительства.
                </li>
                <li>
                  <strong>За 2–3 недели</strong> — приказ о распределении по базам и
                  руководители практики.
                </li>
                <li>
                  <strong>За неделю</strong> — дата и место организационного собрания и
                  инструктажа. Явка обязательна.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "practice-dates",
          title: "Сроки практики",
          summary: "Когда и сколько длится практика на каждом курсе",
          content: (
            <>
              <p>
                Сроки задаются графиком учебного процесса и утверждаются приказом. Ниже — для
                специальности «Лечебное дело»; по другим специальностям уточняйте в деканате.
              </p>
              <div className="wrapper-card p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Курс</TableHead>
                      <TableHead>Практика</TableHead>
                      <TableHead>Длительность</TableHead>
                      <TableHead>Период</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COURSES.flatMap((c) =>
                      c.practices.map((p) => (
                        <TableRow key={c.n + p.title}>
                          <TableCell>{c.n}</TableCell>
                          <TableCell className="whitespace-normal">{p.title}</TableCell>
                          <TableCell>{p.weeks} нед.</TableCell>
                          <TableCell className="whitespace-normal">{c.period}</TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              </div>
              <p className="text-muted-foreground">
                Не прошли практику по уважительной причине — практика переносится по заявлению
                в деканат. Без уважительной причины — это академическая задолженность.
              </p>
            </>
          ),
        },
        {
          id: "practice-bases",
          title: "Базы практики",
          summary: "Где проходит практика и как попасть в другую организацию",
          content: (
            <>
              <p>
                <strong>База практики</strong> — медицинская или фармацевтическая организация, с
                которой у университета заключён договор о практической подготовке.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>клинические базы и кафедры ДВГМУ, симуляционный центр;</li>
                <li>городские и краевые больницы, поликлиники, родильные дома;</li>
                <li>
                  медицинские организации по месту жительства или целевого обучения — по{" "}
                  {docLink("practice-application", "заявке")}.
                </li>
              </ul>
              <p>
                Распределение по базам утверждается приказом. Сменить базу после приказа можно
                только по заявлению через отдел практики.
              </p>
            </>
          ),
        },
        {
          id: "practice-types",
          title: "Виды практики",
          summary: "Учебная и производственная практика, формы проведения",
          content: (
            <>
              <h4 className="h4">Учебная практика</h4>
              <p>
                Знакомство с профессией и отработка базовых навыков ухода за пациентами. Проходит
                на младших курсах, часто в симуляционном центре.
              </p>
              <h4 className="h4">Производственная практика</h4>
              <p>
                Работа в медицинской организации в роли помощника младшего и среднего
                медперсонала, затем помощника врача стационара и поликлиники. Включает
                практику научно-исследовательской работы.
              </p>
              <h4 className="h4">Формы проведения</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <strong>Непрерывно</strong> — отдельный период в графике, обычно летом.
                </li>
                <li>
                  <strong>Дискретно</strong> — чередуется с занятиями в течение семестра.
                </li>
              </ul>
              <p>Список практик по курсам — в блоке «По курсам».</p>
            </>
          ),
        },
        {
          id: "practice-rights",
          title: "Права и обязанности",
          summary: "Что может и что должен студент на практике",
          content: (
            <>
              <h4 className="h4">Студент имеет право</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>на безопасные условия и инструктаж по охране труда;</li>
                <li>получать консультации руководителей от кафедры и от базы;</li>
                <li>пользоваться оборудованием и документацией базы в рамках программы;</li>
                <li>пройти практику по месту жительства — по заявке;</li>
                <li>перенести практику по уважительной причине.</li>
              </ul>
              <h4 className="h4">Студент обязан</h4>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  иметь действующую медицинскую книжку и прививки по требованиям базы;
                </li>
                <li>
                  соблюдать правила внутреннего распорядка базы, охрану труда и санитарный режим;
                </li>
                <li>
                  соблюдать врачебную тайну и медицинскую этику; работать в медицинской форме,
                  сменной обуви, с бейджем;
                </li>
                <li>выполнять программу практики и задания руководителя;</li>
                <li>ежедневно вести дневник практики;</li>
                <li>сдать отчётные документы и получить зачёт в срок.</li>
              </ul>
            </>
          ),
        },
        {
          id: "practice-regulation",
          title: "Положение о практике",
          summary: "Основной документ, по которому организуется практика",
          content: (
            <>
              <p>
                Положение о практической подготовке устанавливает порядок организации и
                проведения практик, права и обязанности студентов, руководителей и баз, порядок
                аттестации по итогам практики.
              </p>
              <DocFiles files={[REGULATION]} />
            </>
          ),
        },
      ],
    },
    {
      title: "По курсам",
      items: COURSES.map(courseEntry),
    },
  ],
};
