import type { FC } from "react";
import { DownloadIcon, FileIcon } from "lucide-react";
import type { LibraryFile } from "@/features/library";
import { downloadFile } from "@/features/library";
import { Button } from "@/shared/ui/button";
import { ReaderShell } from "./reader.shell";

/* Формат, который читалка пока не показывает (EPUB, DOCX): карточка файла и
 * скачивание. Новый формат — свой адаптер рядом и строка в readerFor. */
export const FileFallbackReader: FC<{ file: LibraryFile; title: string; subtitle?: string; backHref: string; backLabel: string }> = ({ file, title, subtitle, backHref, backLabel }) => (
    <ReaderShell title={title} subtitle={subtitle} backHref={backHref} backLabel={backLabel} toc={[]} onNavigate={() => {}} percent={0}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
            <FileIcon className="size-12 text-muted-foreground" />
            <div>
                <div className="font-medium">{file.name}</div>
                <p className="mt-1 text-sm text-muted-foreground">Этот формат пока открывается только после скачивания.</p>
            </div>
            <Button onClick={() => downloadFile(file)}><DownloadIcon />Скачать</Button>
        </div>
    </ReaderShell>
);
