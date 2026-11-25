import { useState } from "react"

import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/shared/ui/dialog"
import { cn } from "@/shared/lib/utils"

export interface DocImageProps {
    /**
     * Номер файла в /public/docs/img — счётный, без имён:
     * n={1} → /docs/img/1.png, n={2} → /docs/img/2.png, …
     */
    n: number | string
    /** Описание: озвучка для скринридеров и текст, если картинка не загрузилась */
    alt: string
    /** Необязательная подпись под картинкой */
    caption?: string
    /** Расширение файла, по умолчанию png */
    ext?: "png" | "jpg" | "jpeg" | "webp" | "gif"
    /** Необязательная подпапка внутри /public/docs/img (например id статьи) */
    dir?: string
    className?: string
}

/**
 * Картинка в статье документации. Файлы лежат в apps/fesmu/web/src/public/docs/img
 * и называются числами (1.png, 2.png …) — так их удобно добавлять пачками и
 * держать под контролем. Клик открывает картинку крупно. Если файла нет —
 * компонент ничего не рисует (статья не ломается).
 */
export function DocImage({ n, alt, caption, ext = "png", dir, className }: DocImageProps) {
    const [failed, setFailed] = useState(false)
    if (failed) return null

    const src = `/docs/img/${dir ? `${dir}/` : ""}${n}.${ext}`

    return (
        <figure className={cn("my-2", className)}>
            <Dialog>
                <DialogTrigger asChild>
                    <button
                        type="button"
                        className="block w-full cursor-zoom-in overflow-hidden rounded-lg border bg-muted transition-opacity hover:opacity-90"
                    >
                        <img
                            src={src}
                            alt={alt}
                            loading="lazy"
                            onError={() => setFailed(true)}
                            className="w-full"
                        />
                    </button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] p-2 sm:max-w-4xl">
                    <DialogTitle className="sr-only">{alt}</DialogTitle>
                    <img src={src} alt={alt} className="h-auto w-full rounded" />
                </DialogContent>
            </Dialog>
            {caption && (
                <figcaption className="mt-1.5 text-xs text-muted-foreground">
                    {caption}
                </figcaption>
            )}
        </figure>
    )
}
