import { ConnectError, createClient } from "@connectrpc/connect";
import { LibraryService } from "@dvgmu/fesmu/service/v2/library.service_pb";
import { connectTransport } from "@/shared/config/api";
import type { BlockFile, Section } from "@/shared/blocks";
import { fromFile, fromItem, fromManual, fromProgress, KIND_TO_PROTO, READER_KIND, toSections } from "./library.convert";
import type { LibraryItem, LibraryItemInput, Manual, ManualCard, ReaderKind, ReaderProgress } from "./library.types";

const client = createClient(LibraryService, connectTransport);

const bytes = async (file?: File) => (file ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array());

/** Текст ошибки сервера («заполните поле «Название»») без префикса кода. */
export const errorText = (error: unknown, fallback: string) =>
    error instanceof ConnectError ? error.rawMessage || fallback : fallback;

const itemInput = (v: LibraryItemInput) => ({
    kind: KIND_TO_PROTO[v.kind],
    title: v.title,
    authors: v.authors,
    year: v.year || 0,
    publisher: v.publisher,
    description: v.description,
    discipline: v.discipline,
    url: v.url,
});

export const libraryApi = {
    async items(query = "", discipline = ""): Promise<LibraryItem[]> {
        const res = await client.libraryItemFetch({ query, discipline });
        return res.items.map(fromItem);
    },

    async item(id: string): Promise<LibraryItem> {
        const res = await client.libraryItemByID({ id: BigInt(id) });
        if (!res.item) throw new Error("издание не найдено");
        return fromItem(res.item);
    },

    async itemCreate(v: LibraryItemInput, file?: File): Promise<string> {
        const res = await client.libraryItemCreate({ item: itemInput(v), fileName: file?.name ?? "", fileContent: await bytes(file) });
        return res.id.toString();
    },

    async itemUpdate(id: string, v: LibraryItemInput, file?: File): Promise<void> {
        await client.libraryItemUpdate({ id: BigInt(id), item: itemInput(v), fileName: file?.name ?? "", fileContent: await bytes(file) });
    },

    async itemDelete(id: string): Promise<void> {
        await client.libraryItemDelete({ id: BigInt(id) });
    },

    async disciplines(): Promise<string[]> {
        return (await client.libraryDisciplineFetch({})).disciplines;
    },

    async upload(file: File): Promise<BlockFile> {
        const res = await client.libraryFileUpload({ fileName: file.name, content: await bytes(file) });
        const stored = fromFile(res.file);
        if (!stored) throw new Error("файл не сохранён");
        return stored;
    },

    async file(id: string): Promise<{ name: string; mimeType: string; content: Uint8Array }> {
        const res = await client.libraryFileFetch({ id: BigInt(id) });
        return { name: res.file?.name ?? "file", mimeType: res.file?.mimeType ?? "application/octet-stream", content: res.content };
    },

    async manuals(discipline = "", query = ""): Promise<Manual[]> {
        const res = await client.manualFetch({ discipline, query });
        return res.manuals.map(fromManual);
    },

    async manual(id: string, draft = false): Promise<{ manual: Manual; literature: LibraryItem[] }> {
        const res = await client.manualByID({ id: BigInt(id), draft });
        if (!res.manual) throw new Error("методичка не найдена");
        return { manual: fromManual(res.manual), literature: res.literature.map(fromItem) };
    },

    async manualCreate(card: ManualCard): Promise<string> {
        return (await client.manualCreate({ manual: card })).id.toString();
    },

    async manualUpdate(id: string, card: ManualCard, sections: Section[]): Promise<void> {
        await client.manualUpdate({ id: BigInt(id), manual: card, sections: toSections(sections) });
    },

    async manualPublish(id: string): Promise<void> {
        await client.manualPublish({ id: BigInt(id) });
    },

    async manualArchive(id: string): Promise<void> {
        await client.manualArchive({ id: BigInt(id) });
    },

    async manualDelete(id: string): Promise<void> {
        await client.manualDelete({ id: BigInt(id) });
    },

    /** Без refId — последние позиции по всему, новые сначала. */
    async progress(kind?: ReaderKind, refId?: string): Promise<ReaderProgress[]> {
        const res = await client.readerProgressFetch({ kind: kind ? READER_KIND[kind] : 0, refId: refId ? BigInt(refId) : 0n });
        return res.progress.map(fromProgress);
    },

    async progressSave(kind: ReaderKind, refId: string, position: string, percent: number): Promise<void> {
        await client.readerProgressSave({ kind: READER_KIND[kind], refId: BigInt(refId), position, percent: Math.round(percent) });
    },
};

