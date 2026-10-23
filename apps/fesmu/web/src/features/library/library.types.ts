import type { Section } from "@/shared/blocks";

export type ItemKind = "file" | "link";

export interface LibraryFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
}

/** Издание каталога. */
export interface LibraryItem {
    id: string;
    kind: ItemKind;
    title: string;
    authors: string;
    year: number;
    publisher: string;
    description: string;
    discipline: string;
    file?: LibraryFile;
    url: string;
    createdBy: string;
    updatedAt?: Date;
}

/** Что пишут в карточке издания; файл — отдельно. */
export interface LibraryItemInput {
    kind: ItemKind;
    title: string;
    authors: string;
    year: number;
    publisher: string;
    description: string;
    discipline: string;
    url: string;
}

export type ManualStatus = "draft" | "published" | "archived";

/** Карточка методички. */
export interface ManualCard {
    discipline: string;
    title: string;
    specialty: string;
    course: number;
    semester: number;
    authors: string;
    annotation: string;
}

export interface Manual extends ManualCard {
    id: string;
    status: ManualStatus;
    draftChanged: boolean;
    sections: Section[];
    updatedBy: string;
    updatedAt?: Date;
    publishedAt?: Date;
}

export type ReaderKind = "item" | "manual";

/** Где читатель остановился. */
export interface ReaderProgress {
    kind: ReaderKind;
    refId: string;
    position: string;
    percent: number;
    title: string;
    updatedAt?: Date;
}
