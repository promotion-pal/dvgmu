import { useEffect, useState } from "react";
import type { BlockFile } from "@/shared/blocks";
import { libraryApi } from "./library.api";

/* Файлы библиотеки отдаёт api (LibraryFileFetch) — по cookie входа, поэтому
 * в <img>/<a> они идут как blob:-адреса. Один файл грузится один раз за сессию. */

const cache = new Map<string, Promise<{ url: string; name: string; bytes: Uint8Array; mimeType: string }>>();

export function loadFile(id: string) {
    let entry = cache.get(id);
    if (!entry) {
        entry = libraryApi.file(id).then((f) => {
            const bytes = new Uint8Array(f.content);
            const url = URL.createObjectURL(new Blob([bytes], { type: f.mimeType }));
            return { url, name: f.name, bytes, mimeType: f.mimeType };
        });
        entry.catch(() => cache.delete(id));
        cache.set(id, entry);
    }
    return entry;
}

/** blob:-адрес файла; пока грузится — undefined. */
export function useFileUrl(file?: BlockFile) {
    const [url, setUrl] = useState<string>();
    const id = file?.id;
    useEffect(() => {
        if (!id) return;
        let alive = true;
        loadFile(id).then((f) => alive && setUrl(f.url), () => {});
        return () => {
            alive = false;
            setUrl(undefined);
        };
    }, [id]);
    return id ? url : undefined;
}

/** Скачать файл под его именем. */
export async function downloadFile(file: { id: string; name: string }) {
    const f = await loadFile(file.id);
    const link = document.createElement("a");
    link.href = f.url;
    link.download = file.name || f.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
}
