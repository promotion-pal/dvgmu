import type { FC, ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/shared/ui/accordion";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { DEBTOR_COLUMN_ORIGIN, DEBTOR_COLUMNS } from "./debtor-admin.columns";

/*
 * Справка для страницы задолженности: источники, расчёт колонок, план
 * развития. Номера таблиц и полей должны совпадать с
 * api/internal/utils/1c (schema.go, turnover.go, 1c-reference.md).
 */

// AccordionContent из ui-кита фиксирует высоту на момент открытия, из-за чего
// вложенные разделы обрезаются; h-auto это отключает, mb-0 убирает лишний
// отступ абзацев поверх gap.
const CONTENT = "h-auto [&_p:not(:last-child)]:mb-0";

const Code: FC<{ children: ReactNode }> = ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">{children}</code>
);

const Section: FC<{ value: string; title: string; children: ReactNode }> = ({ value, title, children }) => (
    <AccordionItem value={value}>
        <AccordionTrigger className="py-3">{title}</AccordionTrigger>
        <AccordionContent className={`${CONTENT} flex flex-col gap-2 text-muted-foreground`}>{children}</AccordionContent>
    </AccordionItem>
);

interface SourceTable {
    table: string;
    what: string;
    used: ReactNode;
    unused: ReactNode;
}

const SOURCE_TABLES: SourceTable[] = [
    {
        table: "_AccRgAT341390",
        what: "Итоги регистра бухгалтерии: помесячные остатки и обороты",
        used: (
            <>
                <Code>_Period</Code>, <Code>_AccountRRef</Code>, <Code>_Value1_RRRef</Code> (контрагент),{" "}
                <Code>_Value2_RRRef</Code> (договор), <Code>_Fld41355</Code> (остаток), <Code>_TurnoverDt41370</Code>{" "}
                (дебет), <Code>_TurnoverCt41371</Code> (кредит)
            </>
        ),
        unused: (
            <>
                <Code>_Value3_RRRef</Code> (КОСГУ), <Code>_Value1..3_RTRef</Code> (вид аналитики)
            </>
        ),
    },
    {
        table: "_Acc54",
        what: "План счетов",
        used: (
            <>
                <Code>_IDRRef</Code>, <Code>_Code</Code> (счёт 205.31)
            </>
        ),
        unused: "Наименование и признаки счёта",
    },
    {
        table: "_Reference203",
        what: "Справочник контрагентов (обучающиеся и плательщики)",
        used: <Code>_Description</Code>,
        unused: "ИНН, КПП, вид лица, адрес, контакты",
    },
    {
        table: "_Reference129",
        what: "Справочник договоров",
        used: <Code>_Description</Code>,
        unused: "Номер, дата, срок, сумма договора, график платежей",
    },
    {
        table: "_Reference227",
        what: "Справочник КОСГУ",
        used: "—",
        unused: "Виды доходов",
    },
    {
        table: "_AccRg41346",
        what: "Проводки регистра бухгалтерии",
        used: "—",
        unused: "Даты операций, документы-основания",
    },
];


type RoadmapStatus = "required" | "ready" | "next" | "later";

const ROADMAP_STATUS: Record<RoadmapStatus, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    required: { label: "Обязательно", variant: "destructive" },
    ready: { label: "Готово к подключению", variant: "default" },
    next: { label: "Следующий этап", variant: "secondary" },
    later: { label: "Перспектива", variant: "outline" },
};

const ROADMAP: { title: string; status: RoadmapStatus; need: string; result: string }[] = [
    {
        title: "ИНН контрагента",
        status: "ready",
        need: "Определение поля ИНН в справочнике контрагентов",
        result: "Точное разделение физических и юридических лиц, поиск по ИНН",
    },
    {
        title: "Данные студента",
        status: "required",
        need: "Сопоставление контрагента с данными обучающегося в MDM (необходимо для уведомлений и личного кабинета)",
        result: "Вывод факультета, курса, группы, статуса обучения и отбор по ним",
    },
    {
        title: "Уведомления о задолженности",
        status: "required",
        need: "Сопоставление со студентом в MDM; интеграция с сервисом уведомлений",
        result: "Автоматическое направление уведомлений о задолженности и сроках оплаты обучающемуся через сервис уведомлений",
    },
    {
        title: "Задолженность в личном кабинете",
        status: "required",
        need: "Сопоставление со студентом в MDM; вход обучающегося в личный кабинет через SSO",
        result: "Просмотр обучающимся собственной задолженности, истории оплат и полученных уведомлений; формирование справки об отсутствии задолженности",
    },
    {
        title: "Реквизиты договора",
        status: "next",
        need: "Определение реквизитов договора: номер, дата, срок, сумма, обучающийся",
        result: "Вывод номера и даты договора, стоимости обучения, доли оплаты",
    },
    {
        title: "Графики оплаты договоров прошлых лет",
        status: "next",
        need: "Проверка с бухгалтерией договоров без графика в текущей базе (перенесённых остатками)",
        result: "Сумма к оплате по графику для всех договоров, а не полный остаток",
    },
    {
        title: "История платежей",
        status: "next",
        need: "Подключение проводок и документов-оснований",
        result: "Точные даты операций, сведения о последней оплате, перечень операций по договору",
    },
    {
        title: "Документы",
        status: "later",
        need: "Определение хранилища присоединённых файлов договоров в 1С",
        result: "Доступ к копии договора; формирование акта сверки, уведомления о задолженности, справки об отсутствии задолженности",
    },
    {
        title: "Выгрузка отчётности",
        status: "later",
        need: "Дополнительные данные 1С не требуются",
        result: "Выгрузка перечня в Excel с учётом установленных фильтров",
    },
    {
        title: "Прямое подключение к базе",
        status: "later",
        need: "Согласование прямого доступа к SQL Server 1С",
        result: "Сокращение времени загрузки данных",
    },
];

const FUTURE_FIELDS: { group: string; fields: string }[] = [
    { group: "Договор", fields: "номер, дата, срок обучения, стоимость, доля оплаты" },
    { group: "Задолженность", fields: "сумма и срок просрочки, ближайший платёж, переплата" },
    { group: "Платежи", fields: "дата и сумма последней оплаты, история операций" },
    { group: "Обучающийся", fields: "факультет, курс, группа, статус обучения" },
    { group: "Уведомления", fields: "дата направления, статус доставки и прочтения обучающимся" },
    { group: "Документы", fields: "копия договора, акт сверки, уведомление о задолженности, справка об отсутствии задолженности" },
];

interface DebtorInfoProps {
    /** 1C database the page is reading, from the API response. */
    source: string;
    /** Whether person/organization comes from INN (true) or the name (false). */
    kindByInn: boolean;
}

const DebtorInfo: FC<DebtorInfoProps> = ({ source, kindByInn }) => (
    <Accordion type="single" collapsible className="mb-4 rounded-lg border border-border px-4">
        <AccordionItem value="info">
            <AccordionTrigger className="py-3">
                <span className="flex items-center gap-2">
                    <InfoIcon className="size-4 text-primary" />
                    Справочная информация: источники данных и методика расчёта
                </span>
            </AccordionTrigger>
            <AccordionContent className={CONTENT}>
                <Accordion type="multiple" defaultValue={["columns"]} className="border-t border-border">
                    <Section value="columns" title="Описание колонок таблицы (№, Студент / Организация, Договор, К оплате сейчас, Ближайший платёж, Квитанция) и раскрытой строки">
                        <p>
                            Обороты в 1С учитываются помесячно, в связи с чем выбранный период приводится к целым календарным
                            месяцам (например, период 15.02–03.03 рассчитывается как 01.02–31.03).
                        </p>
                        <p>
                            Записи разделены на вкладки «Студенты» (физические лица) и «Организации» (юридические лица, в основном
                            заказчики целевого обучения). Вид контрагента в настоящее время определяется{" "}
                            {kindByInn
                                ? "по ИНН"
                                : "по наименованию контрагента и договора; после подключения ИНН — по ИНН (10 знаков — юридическое лицо, 12 — физическое лицо или ИП)"}
                            .
                        </p>
                        <p>Пояснение к каждой колонке также доступно по значку рядом с её заголовком в таблице.</p>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Колонка</TableHead>
                                        <TableHead>Источник</TableHead>
                                        <TableHead>Порядок получения</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {DEBTOR_COLUMNS.map((column) => (
                                        <TableRow key={column.key}>
                                            <TableCell className="align-top font-medium text-foreground">
                                                {column.titleByKind ? `${column.titleByKind.person} / ${column.titleByKind.organization}` : column.title}
                                                {column.detail && <span className="block text-xs font-normal text-muted-foreground">в раскрытой строке</span>}
                                            </TableCell>
                                            <TableCell className="align-top whitespace-normal min-w-44">
                                                <div className="flex flex-col items-start gap-1">
                                                    {DEBTOR_COLUMN_ORIGIN[column.origin]}
                                                    {column.field && <Code>{column.field}</Code>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="align-top whitespace-normal min-w-64">{column.rule}</TableCell>
                                        </TableRow>
                                    ))}
                                    <TableRow>
                                        <TableCell className="align-top font-medium text-foreground">Итого по фильтру</TableCell>
                                        <TableCell className="align-top">{DEBTOR_COLUMN_ORIGIN.app}</TableCell>
                                        <TableCell className="align-top whitespace-normal">
                                            Сумма денежных колонок по всем записям, отобранным фильтрами, а не только по текущей странице.
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </Section>

                    <Section value="path" title="Источник данных">
                        <p>
                            Источником данных является информационная база 1С <Code>{source || "bgu2"}</Code> (конфигурация
                            «Бухгалтерия государственного учреждения», ред. 2). Данные запрашиваются из базы при каждом открытии
                            страницы, изменении периода и обновлении. Доступ к базе осуществляется только в режиме чтения.
                        </p>
                        <p>
                            Наименования таблиц определяются конфигурацией 1С. Текущее описание структуры применимо к базам bgu2
                            и bgu20XX.
                        </p>
                    </Section>

                    <Section value="tables" title="Структура исходных данных 1С">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Таблица</TableHead>
                                        <TableHead>Назначение</TableHead>
                                        <TableHead>Используемые поля</TableHead>
                                        <TableHead>Не используются</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {SOURCE_TABLES.map((row) => (
                                        <TableRow key={row.table}>
                                            <TableCell className="align-top"><Code>{row.table}</Code></TableCell>
                                            <TableCell className="align-top whitespace-normal min-w-44">{row.what}</TableCell>
                                            <TableCell className="align-top whitespace-normal min-w-64">{row.used}</TableCell>
                                            <TableCell className="align-top whitespace-normal min-w-48">{row.unused}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Section>

                    <Section value="debt" title="Определение задолженности">
                        <p>
                            Задолженность определяется по счёту 205.31 «Расчёты по доходам от оказания платных услуг». Начисление
                            по договору отражается по дебету счёта, поступление оплаты отражается по кредиту.
                        </p>
                        <p>
                            Дебетовый остаток по договору отражает всю сумму, подлежащую оплате за весь срок обучения: договор
                            отражается в учёте на полную стоимость. Поэтому основным показателем является сумма к оплате на
                            текущую дату.
                        </p>
                        <p>
                            Сумма к оплате определяется по графику оплаты договора (табличная часть «Порядок оплаты» документа
                            «Начисление доходов будущих периодов (образование)»): из текущего остатка исключаются платежи, срок
                            которых («Оплатить до») ещё не наступил. Оплата вперёд даёт нулевую сумму к оплате.
                        </p>
                        <p>
                            Для договоров, по которым график оплаты в базе 1С отсутствует (в том числе перенесённых из баз прошлых
                            лет), сумма к оплате принимается равной полному остатку и отмечается «нет графика».
                        </p>
                    </Section>

                    <Section value="roadmap" title="Направления развития">
                        <ol className="flex flex-col gap-2">
                            {ROADMAP.map((step) => (
                                <li key={step.title} className="rounded-lg border border-border p-3">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-foreground">{step.title}</span>
                                        <Badge variant={ROADMAP_STATUS[step.status].variant}>{ROADMAP_STATUS[step.status].label}</Badge>
                                    </div>
                                    <p className="text-xs">Требуется: {step.need}</p>
                                    <p className="text-xs">Результат: {step.result}</p>
                                </li>
                            ))}
                        </ol>
                    </Section>

                    <Section value="fields" title="Перспективный состав данных">
                        <ul className="flex flex-col gap-1">
                            {FUTURE_FIELDS.map((item) => (
                                <li key={item.group}>
                                    <span className="text-foreground">{item.group}:</span> {item.fields}
                                </li>
                            ))}
                        </ul>
                    </Section>
                </Accordion>
            </AccordionContent>
        </AccordionItem>
    </Accordion>
);

export { DebtorInfo };
