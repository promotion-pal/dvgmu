import { useMemo, useState } from "react";
import type { CommonPaginationProps } from "./pagination";

const DEFAULT_PAGE_SIZE = 24;

interface UsePaginationOptions {
    pageSize?: number;
    /** Changing this (a search string, a filter value, ...) sends the list back to page 1. */
    resetKey?: unknown;
}

/** Client-side paging over an already-filtered list, so a few thousand
 * cards are never rendered at once. `paginationProps` spreads straight
 * into <CommonPagination />. */
export const usePagination = <T,>(items: T[], { pageSize = DEFAULT_PAGE_SIZE, resetKey }: UsePaginationOptions = {}) => {
    const [state, setState] = useState({ page: 1, resetKey });
    if (state.resetKey !== resetKey) {
        setState({ page: 1, resetKey });
    }

    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    // Clamped, not stored: deleting the last item of the last page must not leave an empty page.
    const page = Math.min(state.page, pageCount);

    const pageItems = useMemo(() => items.slice((page - 1) * pageSize, page * pageSize), [items, page, pageSize]);

    const onPageChange = (next: number) => {
        setState((prev) => ({ ...prev, page: Math.min(Math.max(1, next), pageCount) }));
        window.scrollTo({ top: 0 });
    };

    return {
        pageItems,
        paginationProps: { page, pageCount, total: items.length, pageSize, onPageChange } satisfies CommonPaginationProps,
    };
};
