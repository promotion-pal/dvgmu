import type { LibraryFile } from "@/features/library";

export type ReaderFormat = "pdf" | "file";

/** Каким адаптером открыть файл. */
export const readerFor = (file: LibraryFile): ReaderFormat =>
    file.mimeType === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "file";
