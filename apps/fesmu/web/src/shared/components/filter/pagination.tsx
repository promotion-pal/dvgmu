import type { FC } from "react";
import { ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";

export interface CommonPaginationProps {
    page: number;
    pageCount: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
}

/** First, last, current and its neighbours; gaps collapse into an ellipsis. */
const visiblePages = (page: number, pageCount: number): (number | "gap")[] => {
    const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
    const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);

    const result: (number | "gap")[] = [];
    pages.forEach((p, i) => {
        if (i > 0 && p - pages[i - 1] > 1) result.push("gap");
        result.push(p);
    });
    return result;
};

export const CommonPagination: FC<CommonPaginationProps> = ({ page, pageCount, total, pageSize, onPageChange }) => {
    if (pageCount <= 1) return null;

    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
        <nav aria-label="Пагинация" className="mt-6 flex flex-col-reverse items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm text-muted-foreground">
                Показано {from}–{to} из {total}
            </p>

            <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => onPageChange(1)} aria-label="Первая страница">
                    <ChevronsLeftIcon className="size-4" />
                </Button>
                <Button variant="outline" size="icon" className="size-8" disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Предыдущая страница">
                    <ChevronLeftIcon className="size-4" />
                </Button>

                {visiblePages(page, pageCount).map((item, i) =>
                    item === "gap" ? (
                        <span key={`gap-${i}`} className="px-1 text-muted-foreground">…</span>
                    ) : (
                        <Button
                            key={item}
                            variant={item === page ? "default" : "outline"}
                            size="icon"
                            className={cn("size-8 text-xs", item === page && "pointer-events-none")}
                            aria-current={item === page ? "page" : undefined}
                            onClick={() => onPageChange(item)}
                        >
                            {item}
                        </Button>
                    ),
                )}

                <Button variant="outline" size="icon" className="size-8" disabled={page === pageCount} onClick={() => onPageChange(page + 1)} aria-label="Следующая страница">
                    <ChevronRightIcon className="size-4" />
                </Button>
                <Button variant="outline" size="icon" className="size-8" disabled={page === pageCount} onClick={() => onPageChange(pageCount)} aria-label="Последняя страница">
                    <ChevronsRightIcon className="size-4" />
                </Button>
            </div>
        </nav>
    );
};
