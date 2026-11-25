/* Блоки методички — плоские типы для страницы. Контракт (proto) —
 * api/contract/entity/v2/library.entity.proto, ManualBlock; перевод туда и
 * обратно — в widgets/manual (manual.api.ts). Новый вид блока: message и
 * case в oneof → тип здесь → View и Edit → строка в реестре (blocks.registry.tsx). */

export type CalloutTone = "info" | "important" | "warning" | "clinical";

/** Файл, сохранённый библиотекой (id — в сервисе файлов). */
export interface BlockFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
}

export interface QuizQuestion {
    text: string;
    options: string[];
    /** Индексы верных вариантов; несколько — множественный выбор. */
    correct: number[];
    explanation: string;
}

export interface GlossaryTerm {
    term: string;
    definition: string;
}

export type Block =
    | { id: string; kind: "heading"; text: string; level: 2 | 3 | 4 }
    | { id: string; kind: "text"; text: string }
    | { id: string; kind: "figure"; file?: BlockFile; caption: string; source: string }
    | { id: string; kind: "table"; caption: string; header: boolean; rows: string[][] }
    | { id: string; kind: "callout"; tone: CalloutTone; title: string; text: string }
    | { id: string; kind: "video"; url: string; caption: string }
    | { id: string; kind: "attachment"; file?: BlockFile; title: string }
    | { id: string; kind: "case"; title: string; condition: string; questions: string[]; answer: string }
    | { id: string; kind: "quiz"; title: string; questions: QuizQuestion[] }
    | { id: string; kind: "checklist"; title: string; ordered: boolean; steps: string[] }
    | { id: string; kind: "glossary"; terms: GlossaryTerm[] }
    | { id: string; kind: "literature"; title: string; itemIds: string[] }
    | { id: string; kind: "divider" };

export type BlockKind = Block["kind"];

/** Блок вида K. */
export type BlockOf<K extends BlockKind> = Extract<Block, { kind: K }>;

/** Тема методички: название и блоки. */
export interface Section {
    id: string;
    title: string;
    blocks: Block[];
}

/** Издание каталога, на которое ссылается блок «Литература». */
export interface LiteratureRef {
    id: string;
    title: string;
    authors: string;
    year: number;
    /** Куда вести: читалка издания или внешняя ссылка. */
    href: string;
    external: boolean;
}

/** Новый id блока или темы — стабильный внутри методички. */
export const newId = () =>
    globalThis.crypto?.randomUUID?.().slice(0, 12) ?? Math.random().toString(36).slice(2, 14);
