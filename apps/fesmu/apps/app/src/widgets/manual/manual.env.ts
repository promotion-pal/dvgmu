import { useEffect, useMemo, useState } from "react";
import { generatePath } from "react-router-dom";
import { downloadFile, libraryApi, useFileUrl } from "@/features/library";
import type { LibraryItem } from "@/features/library";
import type { BlocksEnv, LiteratureRef } from "@/shared/blocks";
import { ROUTE } from "@/shared/config/path";

export const toRef = (it: LibraryItem): LiteratureRef => ({
    id: it.id,
    title: it.title,
    authors: it.authors,
    year: it.year,
    href: it.kind === "link" ? it.url : generatePath(ROUTE.LIBRARY.ITEM, { id: it.id }),
    external: it.kind === "link",
});

/** Окружение блоков для чтения: файлы через api, литература методички. */
export function useReadEnv(literature: LibraryItem[]): BlocksEnv {
    return useMemo(
        () => ({ useFileUrl, download: (f) => void downloadFile(f), literature: new Map(literature.map((it) => [it.id, toRef(it)])) }),
        [literature],
    );
}

/** Окружение блоков для редактора: ещё загрузка файлов и весь каталог. */
export function useEditEnv(): BlocksEnv {
    const [catalog, setCatalog] = useState<LibraryItem[]>([]);
    useEffect(() => {
        libraryApi.items().then(setCatalog, () => {});
    }, []);
    return useMemo(() => {
        const refs = catalog.map(toRef);
        return {
            useFileUrl,
            download: (f) => void downloadFile(f),
            literature: new Map(refs.map((r) => [r.id, r])),
            catalog: refs,
            upload: (file: File) => libraryApi.upload(file),
        };
    }, [catalog]);
}
