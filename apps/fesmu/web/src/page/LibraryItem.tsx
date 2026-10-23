import { Suspense, lazy, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { DownloadIcon } from "lucide-react";
import { downloadFile, libraryApi } from "@/features/library";
import type { LibraryItem } from "@/features/library";
import { CommonControlState } from "@/shared/components/state/control-state";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { FileFallbackReader, readerFor } from "@/widgets/reader";

// pdf.js тяжёлый — грузится, только когда открывают PDF.
const PdfReader = lazy(() => import("@/widgets/reader/reader.pdf").then((m) => ({ default: m.PdfReader })));

/** Издание каталога в читалке: PDF — постранично, остальное — скачать. */
export default function LibraryItemPage() {
    const { id = "" } = useParams();
    // Ответ помнит, для какого id он: при переходе к другому изданию старое не показываем.
    const [loaded, setLoaded] = useState<{ id: string; item?: LibraryItem; error?: boolean }>();
    const item = loaded?.id === id ? loaded.item : undefined;
    const error = loaded?.id === id && Boolean(loaded.error);

    useEffect(() => {
        libraryApi.item(id).then(
            (it) => setLoaded({ id, item: it }),
            () => setLoaded({ id, error: true }),
        );
    }, [id]);

    // Ссылка открывается там, куда ведёт.
    useEffect(() => {
        if (item?.kind === "link") window.location.replace(item.url);
    }, [item]);

    if (!item) return <CommonControlState isLoading={!error} isError={error} isEmpty={false} styleWrapper="w-full p-6" />;

    const subtitle = [item.authors, item.year || ""].filter(Boolean).join(", ");
    const back = { backHref: ROUTE.LIBRARY.CATALOG, backLabel: "В каталог" };
    if (item.kind === "link" || !item.file) return null;
    const file = item.file;
    if (readerFor(file) === "pdf") {
        return (
            <Suspense fallback={<CommonControlState isLoading isError={false} isEmpty={false} styleWrapper="w-full p-6" />}>
                <PdfReader
                    key={item.id}
                    refId={item.id}
                    fileId={file.id}
                    title={item.title}
                    subtitle={subtitle}
                    {...back}
                    tools={<Button variant="ghost" size="icon-sm" aria-label="Скачать" onClick={() => downloadFile(file)}><DownloadIcon /></Button>}
                />
            </Suspense>
        );
    }
    return <FileFallbackReader file={file} title={item.title} subtitle={subtitle} {...back} />;
}
