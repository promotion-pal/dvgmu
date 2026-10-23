import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import type { MessageInitShape } from "@bufbuild/protobuf";
import type {
    LibraryFile as FileMessage,
    LibraryItem as ItemMessage,
    Manual as ManualMessage,
    ManualBlock as BlockMessage,
    ManualSection as SectionMessage,
    ManualSectionSchema,
    ReaderProgress as ProgressMessage,
} from "@dvgmu/contract/fesmu/entity/v2/library.entity_pb";
import { LibraryItemKind, ManualCalloutTone, ManualStatus as StatusEnum, ReaderSourceKind } from "@dvgmu/contract/fesmu/enum/v2/library.enum_pb";
import type { Block, BlockFile, CalloutTone, Section } from "@/shared/blocks";
import type { ItemKind, LibraryFile, LibraryItem, Manual, ManualStatus, ReaderKind, ReaderProgress } from "./library.types";

/* Перевод сообщений контракта в плоские типы страницы и обратно. */

const toDate = (t?: Timestamp) => (t ? timestampDate(t) : undefined);

export const fromFile = (m?: FileMessage): LibraryFile | undefined =>
    m && m.id ? { id: m.id.toString(), name: m.name, mimeType: m.mimeType, size: Number(m.size) } : undefined;

const toFile = (f?: BlockFile) => (f ? { id: BigInt(f.id), name: f.name, mimeType: f.mimeType, size: BigInt(f.size) } : undefined);

export const KIND_TO_PROTO: Record<ItemKind, LibraryItemKind> = { file: LibraryItemKind.FILE, link: LibraryItemKind.LINK };

export const fromItem = (m: ItemMessage): LibraryItem => ({
    id: m.id.toString(),
    kind: m.kind === LibraryItemKind.LINK ? "link" : "file",
    title: m.title,
    authors: m.authors,
    year: m.year,
    publisher: m.publisher,
    description: m.description,
    discipline: m.discipline,
    file: fromFile(m.file),
    url: m.url,
    createdBy: m.createdBy,
    updatedAt: toDate(m.updatedAt),
});

const TONES: Record<CalloutTone, ManualCalloutTone> = {
    info: ManualCalloutTone.INFO,
    important: ManualCalloutTone.IMPORTANT,
    warning: ManualCalloutTone.WARNING,
    clinical: ManualCalloutTone.CLINICAL,
};
const toneOf = (t: ManualCalloutTone): CalloutTone =>
    (Object.entries(TONES).find(([, v]) => v === t)?.[0] as CalloutTone | undefined) ?? "info";

const fromBlock = (m: BlockMessage): Block | undefined => {
    const id = m.id;
    const b = m.body;
    switch (b.case) {
        case "heading": return { id, kind: "heading", text: b.value.text, level: (Math.min(4, Math.max(2, b.value.level)) as 2 | 3 | 4) };
        case "text": return { id, kind: "text", text: b.value.text };
        case "figure": return { id, kind: "figure", file: fromFile(b.value.file), caption: b.value.caption, source: b.value.source };
        case "table": return { id, kind: "table", caption: b.value.caption, header: b.value.header, rows: b.value.rows.map((r) => [...r.cells]) };
        case "callout": return { id, kind: "callout", tone: toneOf(b.value.tone), title: b.value.title, text: b.value.text };
        case "video": return { id, kind: "video", url: b.value.url, caption: b.value.caption };
        case "attachment": return { id, kind: "attachment", file: fromFile(b.value.file), title: b.value.title };
        case "clinicalCase": return { id, kind: "case", title: b.value.title, condition: b.value.condition, questions: [...b.value.questions], answer: b.value.answer };
        case "quiz": return {
            id, kind: "quiz", title: b.value.title,
            questions: b.value.questions.map((q) => ({ text: q.text, options: [...q.options], correct: [...q.correct], explanation: q.explanation })),
        };
        case "checklist": return { id, kind: "checklist", title: b.value.title, ordered: b.value.ordered, steps: [...b.value.steps] };
        case "glossary": return { id, kind: "glossary", terms: b.value.terms.map((t) => ({ term: t.term, definition: t.definition })) };
        case "literature": return { id, kind: "literature", title: b.value.title, itemIds: b.value.itemIds.map(String) };
        case "divider": return { id, kind: "divider" };
        default: return undefined;
    }
};

const clean = (lines: string[]) => lines.map((l) => l.trim()).filter(Boolean);

type BlockInit = MessageInitShape<typeof ManualSectionSchema>["blocks"] extends (infer B)[] | undefined ? B : never;

const toBlock = (b: Block): BlockInit => {
    const id = b.id;
    switch (b.kind) {
        case "heading": return { id, body: { case: "heading", value: { text: b.text, level: b.level } } };
        case "text": return { id, body: { case: "text", value: { text: b.text } } };
        case "figure": return { id, body: { case: "figure", value: { file: toFile(b.file), caption: b.caption, source: b.source } } };
        case "table": return { id, body: { case: "table", value: { caption: b.caption, header: b.header, rows: b.rows.map((cells) => ({ cells })) } } };
        case "callout": return { id, body: { case: "callout", value: { tone: TONES[b.tone], title: b.title, text: b.text } } };
        case "video": return { id, body: { case: "video", value: { url: b.url.trim(), caption: b.caption } } };
        case "attachment": return { id, body: { case: "attachment", value: { file: toFile(b.file), title: b.title } } };
        case "case": return { id, body: { case: "clinicalCase", value: { title: b.title, condition: b.condition, questions: clean(b.questions), answer: b.answer } } };
        case "quiz": return {
            id,
            body: {
                case: "quiz",
                value: { title: b.title, questions: b.questions.map((q) => ({ text: q.text, options: q.options, correct: q.correct, explanation: q.explanation })) },
            },
        };
        case "checklist": return { id, body: { case: "checklist", value: { title: b.title, ordered: b.ordered, steps: clean(b.steps) } } };
        case "glossary": return { id, body: { case: "glossary", value: { terms: b.terms.filter((t) => t.term.trim()) } } };
        case "literature": return { id, body: { case: "literature", value: { title: b.title, itemIds: b.itemIds.map(BigInt) } } };
        case "divider": return { id, body: { case: "divider", value: {} } };
    }
};

export const fromSections = (list: SectionMessage[]): Section[] =>
    list.map((s) => ({ id: s.id, title: s.title, blocks: s.blocks.map(fromBlock).filter((b) => b !== undefined) }));

export const toSections = (list: Section[]) => list.map((s) => ({ id: s.id, title: s.title.trim(), blocks: s.blocks.map(toBlock) }));

const STATUS: Record<number, ManualStatus> = {
    [StatusEnum.DRAFT]: "draft",
    [StatusEnum.PUBLISHED]: "published",
    [StatusEnum.ARCHIVED]: "archived",
};

export const fromManual = (m: ManualMessage): Manual => ({
    id: m.id.toString(),
    discipline: m.discipline,
    title: m.title,
    specialty: m.specialty,
    course: m.course,
    semester: m.semester,
    authors: m.authors,
    annotation: m.annotation,
    status: STATUS[m.status] ?? "draft",
    draftChanged: m.draftChanged,
    sections: fromSections(m.sections),
    updatedBy: m.updatedBy,
    updatedAt: toDate(m.updatedAt),
    publishedAt: toDate(m.publishedAt),
});

export const READER_KIND: Record<ReaderKind, ReaderSourceKind> = {
    item: ReaderSourceKind.ITEM,
    manual: ReaderSourceKind.MANUAL,
};

export const fromProgress = (m: ProgressMessage): ReaderProgress => ({
    kind: m.kind === ReaderSourceKind.MANUAL ? "manual" : "item",
    refId: m.refId.toString(),
    position: m.position,
    percent: m.percent,
    title: m.title,
    updatedAt: toDate(m.updatedAt),
});
