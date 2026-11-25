import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { BookOpenIcon, ClipboardCheckIcon, FileTextIcon, HeadingIcon, ImageIcon, ListChecksIcon, MessageSquareWarningIcon, MinusIcon, PaperclipIcon, SpellCheckIcon, StethoscopeIcon, TableIcon, VideoIcon } from "lucide-react";
import * as E from "./blocks.edit";
import type { EditProps } from "./blocks.edit";
import type { BlockKind, BlockOf } from "./blocks.types";
import { newId } from "./blocks.types";
import * as V from "./blocks.view";

/* Реестр блоков: вид → подпись, иконка, пустой блок, просмотр и правка.
 * Читалка и редактор берут компоненты только отсюда. */
export interface BlockSpec<K extends BlockKind> {
    label: string;
    hint: string;
    icon: LucideIcon;
    create: () => BlockOf<K>;
    View: FC<{ block: BlockOf<K> }>;
    Edit: FC<EditProps<K>>;
}

type Registry = { [K in BlockKind]: BlockSpec<K> };

export const BLOCKS: Registry = {
    heading: { label: "Заголовок", hint: "Раздел внутри темы", icon: HeadingIcon, create: () => ({ id: newId(), kind: "heading", text: "", level: 2 }), View: V.HeadingView, Edit: E.HeadingEdit },
    text: { label: "Текст", hint: "Абзацы и списки", icon: FileTextIcon, create: () => ({ id: newId(), kind: "text", text: "" }), View: V.TextView, Edit: E.TextEdit },
    figure: { label: "Рисунок", hint: "Изображение с подписью", icon: ImageIcon, create: () => ({ id: newId(), kind: "figure", caption: "", source: "" }), View: V.FigureView, Edit: E.FigureEdit },
    table: { label: "Таблица", hint: "Строки и столбцы", icon: TableIcon, create: () => ({ id: newId(), kind: "table", caption: "", header: true, rows: [["", ""], ["", ""]] }), View: V.TableView, Edit: E.TableEdit },
    callout: { label: "Выноска", hint: "Важно, справка, клиническая заметка", icon: MessageSquareWarningIcon, create: () => ({ id: newId(), kind: "callout", tone: "important", title: "", text: "" }), View: V.CalloutView, Edit: E.CalloutEdit },
    video: { label: "Видео", hint: "RuTube, VK Видео, YouTube", icon: VideoIcon, create: () => ({ id: newId(), kind: "video", url: "", caption: "" }), View: V.VideoView, Edit: E.VideoEdit },
    attachment: { label: "Файл", hint: "Вложение для скачивания", icon: PaperclipIcon, create: () => ({ id: newId(), kind: "attachment", title: "" }), View: V.AttachmentView, Edit: E.AttachmentEdit },
    case: { label: "Ситуационная задача", hint: "Условие, вопросы, эталон ответа", icon: StethoscopeIcon, create: () => ({ id: newId(), kind: "case", title: "", condition: "", questions: [], answer: "" }), View: V.CaseView, Edit: E.CaseEdit },
    quiz: { label: "Самопроверка", hint: "Вопросы с вариантами ответа", icon: ClipboardCheckIcon, create: () => ({ id: newId(), kind: "quiz", title: "", questions: [{ text: "", options: ["", ""], correct: [], explanation: "" }] }), View: V.QuizView, Edit: E.QuizEdit },
    checklist: { label: "Алгоритм", hint: "Шаги манипуляции", icon: ListChecksIcon, create: () => ({ id: newId(), kind: "checklist", title: "", ordered: true, steps: [] }), View: V.ChecklistView, Edit: E.ChecklistEdit },
    glossary: { label: "Глоссарий", hint: "Термины и определения", icon: SpellCheckIcon, create: () => ({ id: newId(), kind: "glossary", terms: [{ term: "", definition: "" }] }), View: V.GlossaryView, Edit: E.GlossaryEdit },
    literature: { label: "Литература", hint: "Издания из каталога", icon: BookOpenIcon, create: () => ({ id: newId(), kind: "literature", title: "", itemIds: [] }), View: V.LiteratureView, Edit: E.LiteratureEdit },
    divider: { label: "Разделитель", hint: "Горизонтальная линия", icon: MinusIcon, create: () => ({ id: newId(), kind: "divider" }), View: V.DividerView, Edit: E.DividerEdit },
};

export const BLOCK_KINDS = Object.keys(BLOCKS) as BlockKind[];
