import { useState } from "react";
import type { FC } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { PurchaseLot } from "@dvgmu/fesmu/entity/v3/purchase.entity_pb";
import { cn } from "@/shared/lib/utils";
import type { PurchaseV3State } from "./purchase-v3.fn";
import { isOverdue, lotKey, PurchaseLotStatus, rub } from "./purchase-v3.schema";
import { LotBadge, TermChip } from "./purchase-v3.ui";

/** Sections of ОКПД2 (ОК 034-2014): the first two digits of a code. */
const OKPD2_CLASS: Record<string, string> = {
    "01": "Продукция сельского хозяйства и охоты",
    "02": "Продукция лесоводства и лесозаготовок",
    "03": "Рыба и продукция рыболовства",
    "08": "Продукция горнодобывающих производств прочая",
    "10": "Продукты пищевые",
    "11": "Напитки",
    "13": "Текстиль и изделия текстильные",
    "14": "Одежда",
    "15": "Кожа и изделия из кожи",
    "16": "Древесина и изделия из дерева",
    "17": "Бумага и изделия из бумаги",
    "18": "Услуги печатные и копирование записей",
    "19": "Кокс и нефтепродукты",
    "20": "Вещества и продукты химические",
    "21": "Лекарственные средства и медицинские материалы",
    "22": "Изделия резиновые и пластмассовые",
    "23": "Продукты минеральные неметаллические прочие",
    "24": "Металлы основные",
    "25": "Изделия металлические готовые",
    "26": "Оборудование компьютерное, электронное и оптическое",
    "27": "Оборудование электрическое",
    "28": "Машины и оборудование прочие",
    "29": "Средства автотранспортные",
    "30": "Средства транспортные прочие",
    "31": "Мебель",
    "32": "Изделия готовые прочие",
    "33": "Ремонт и монтаж машин и оборудования",
    "35": "Электроэнергия, газ, пар, кондиционирование",
    "36": "Вода; водоснабжение",
    "37": "Водоотведение",
    "38": "Сбор, обработка и утилизация отходов",
    "41": "Здания и работы по возведению зданий",
    "42": "Сооружения и строительные работы",
    "43": "Работы строительные специализированные",
    "45": "Торговля и ремонт автотранспортных средств",
    "46": "Услуги по оптовой торговле",
    "47": "Услуги по розничной торговле",
    "49": "Услуги сухопутного транспорта",
    "52": "Складирование и вспомогательные транспортные услуги",
    "53": "Услуги почтовой связи и курьерские",
    "55": "Временное проживание",
    "56": "Общественное питание",
    "58": "Услуги издательские",
    "59": "Кино, видео, звукозапись",
    "61": "Услуги телекоммуникационные",
    "62": "Программные продукты и разработка ПО",
    "63": "Услуги в области информационных технологий",
    "64": "Услуги финансовые",
    "65": "Страхование",
    "68": "Операции с недвижимым имуществом",
    "69": "Услуги юридические и бухгалтерские",
    "70": "Консультации в области управления",
    "71": "Архитектура, инженерные изыскания, испытания и анализ",
    "72": "Научные исследования и разработки",
    "73": "Реклама и исследование рынка",
    "74": "Услуги профессиональные, научные и технические прочие",
    "77": "Аренда и лизинг",
    "78": "Трудоустройство и подбор персонала",
    "79": "Туристические агентства и бронирование",
    "80": "Обеспечение безопасности",
    "81": "Обслуживание зданий и территорий",
    "82": "Административно-хозяйственное обслуживание",
    "84": "Государственное управление и социальное обеспечение",
    "85": "Образование",
    "86": "Здравоохранение",
    "90": "Творчество, искусство и развлечения",
    "91": "Библиотеки, архивы, музеи",
    "93": "Спорт, развлечения и отдых",
    "95": "Ремонт компьютеров и бытовых товаров",
    "96": "Услуги персональные прочие",
};

export type CodeMode = "okpd2" | "ktru";

interface Leaf {
    code: string;
    lot: PurchaseLot;
}
interface Group {
    key: string;
    lots: Leaf[];
}
interface Section {
    key: string;
    name: string;
    groups: Group[];
}

const NO_CODE = "—";

/** The code a purchase is filed under: its ОКПД2, or its КТРУ (whose part
 *  before the dash is the ОКПД2 it refines). */
const codeOf = (l: PurchaseLot, mode: CodeMode) => (mode === "okpd2" ? l.okpd2 : l.ktru).trim();

/** Section → group (the first two levels: 32.50) → purchases by full code. */
const codeTree = (lots: PurchaseLot[], mode: CodeMode): Section[] => {
    const sections = new Map<string, Map<string, Leaf[]>>();
    for (const lot of lots) {
        const code = codeOf(lot, mode);
        const m = /^(\d{2})(?:\.(\d{2}))?/.exec(code);
        const section = m ? m[1] : NO_CODE;
        const group = m ? (m[2] ? `${m[1]}.${m[2]}` : m[1]) : NO_CODE;
        const groups = sections.get(section) ?? new Map<string, Leaf[]>();
        groups.set(group, [...(groups.get(group) ?? []), { code: code || NO_CODE, lot }]);
        sections.set(section, groups);
    }
    return [...sections.entries()]
        .sort(([a], [b]) => (a === NO_CODE ? 1 : b === NO_CODE ? -1 : a.localeCompare(b)))
        .map(([key, groups]) => ({
            key,
            name: key === NO_CODE ? (mode === "okpd2" ? "Без кода ОКПД2" : "Без кода КТРУ") : (OKPD2_CLASS[key] ?? "Раздел классификатора"),
            groups: [...groups.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([g, leaves]) => ({ key: g, lots: leaves.sort((x, y) => x.code.localeCompare(y.code) || Number(x.lot.id - y.lot.id)) })),
        }));
};

const total = (leaves: Leaf[]) => leaves.reduce((s, x) => s + x.lot.totalAmount, 0n);
const late = (leaves: Leaf[]) => leaves.filter((x) => x.lot.status !== PurchaseLotStatus.COMPLETED && isOverdue(x.lot)).length;

const Totals: FC<{ leaves: Leaf[] }> = ({ leaves }) => {
    const overdue = late(leaves);
    return (
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground">
            {leaves.length} шт.{overdue > 0 && <span className="text-red-600 dark:text-red-400">· просрочено {overdue}</span>}
            <span className="tabular-nums">{rub(total(leaves))}</span>
        </span>
    );
};

/** Purchases filed by classifier code: a section of the classifier, the code
 *  groups in it, the purchases under each with their full code. `wide` adds
 *  the department and terms, for the summary. */
export const CodeTree: FC<{ state: PurchaseV3State; lots: PurchaseLot[]; mode: CodeMode; wide?: boolean }> = ({ state, lots, mode, wide }) => {
    const tree = codeTree(lots, mode);
    const [open, setOpen] = useState<string[]>(() => (tree.length <= 3 ? tree.map((s) => s.key) : []));
    const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));
    if (lots.length === 0) return <p className="p-4 text-center text-sm text-muted-foreground">Закупок нет</p>;

    return (
        <div className="flex flex-col gap-1.5">
            {tree.map((section) => {
                const all = section.groups.flatMap((g) => g.lots);
                const opened = open.includes(section.key);
                return (
                    <div key={section.key} className="rounded-lg border">
                        <button type="button" onClick={() => toggle(section.key)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50">
                            <ChevronRightIcon className={cn("size-4 shrink-0 transition-transform", opened && "rotate-90")} />
                            <span className="shrink-0 font-mono">{section.key}</span>
                            <span className="min-w-0 truncate">{section.name}</span>
                            <Totals leaves={all} />
                        </button>
                        {opened &&
                            section.groups.map((group) => (
                                <div key={group.key} className="border-t">
                                    {group.key !== section.key && (
                                        <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 pl-9 text-xs font-medium">
                                            <span className="font-mono">{group.key}</span>
                                            <Totals leaves={group.lots} />
                                        </div>
                                    )}
                                    {group.lots.map(({ code, lot }) => (
                                        <button
                                            key={lot.id.toString()}
                                            type="button"
                                            onClick={() => state.select(lotKey(lot))}
                                            className={cn(
                                                "grid w-full gap-x-3 gap-y-1 border-t px-3 py-2 pl-9 text-left text-sm first:border-t-0 hover:bg-muted/50",
                                                wide ? "sm:grid-cols-[150px_1fr_200px_auto_auto]" : "grid-cols-[1fr_auto]",
                                                state.selected === lotKey(lot) && "bg-muted/60",
                                            )}
                                        >
                                            <span className={cn("font-mono text-xs text-muted-foreground", !wide && "col-span-2")}>
                                                {code} · №{lot.id.toString()}
                                            </span>
                                            <span className="line-clamp-2 min-w-0">{lot.title}</span>
                                            {wide && (
                                                <span className="text-xs text-muted-foreground">
                                                    {state.departmentName(lot.implementingDepartment)} · {state.curatorName(lot.curatorId)}
                                                </span>
                                            )}
                                            {wide && (
                                                <span className="flex flex-col items-start gap-1">
                                                    <LotBadge l={lot} />
                                                    {lot.status !== PurchaseLotStatus.COMPLETED && <TermChip label="этап" due={lot.stageDue} />}
                                                </span>
                                            )}
                                            <span className="text-right text-xs whitespace-nowrap tabular-nums">{rub(lot.totalAmount)}</span>
                                            {!wide && (
                                                <span className="col-span-2">
                                                    <LotBadge l={lot} />
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ))}
                    </div>
                );
            })}
        </div>
    );
};
