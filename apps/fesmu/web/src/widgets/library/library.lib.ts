import { generatePath } from "react-router-dom";
import type { LibraryItem } from "@/features/library";
import { ROUTE } from "@/shared/config/path";

/** Куда ведёт издание: читалка или внешняя ссылка. */
export const itemHref = (it: LibraryItem) => (it.kind === "link" ? it.url : generatePath(ROUTE.LIBRARY.ITEM, { id: it.id }));
