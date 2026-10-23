import { ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { useNavigate } from "react-router-dom";
import { ROUTE } from "@/shared/config/path";
import { DocFile } from "./docs.blocks";
import { DOCS, type ResolvedDoc } from "./docs.data";

export function DocsItem({ doc }: { doc: ResolvedDoc }) {
    return (
        <article className="w-full">
            <p className="text-sm text-muted-foreground mb-1">
                {doc.category.title} / {doc.group.title}
            </p>
            <h1 className="h2 mb-2">{doc.entry.title}</h1>
            {doc.entry.summary && (
                <p className="text-muted-foreground mb-4">{doc.entry.summary}</p>
            )}
            {doc.category.source && (
                <div className="mb-6 max-w-md">
                    <DocFile source={doc.category.source} />
                </div>
            )}
            <div className="flex flex-col gap-4 text-sm leading-relaxed [&_h4]:mt-2">
                {doc.entry.content}
            </div>
        </article>
    )
}

/** В общем списке у длинной группы видны первые статьи, остальные — по ссылке «Ещё». */
const PREVIEW_LIMIT = 5;

function plural(n: number, [one, few, many]: [string, string, string]) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
}

export function DocsList({
    categoryId,
    groupTitle,
}: {
    categoryId?: string | null;
    groupTitle?: string | null;
} = {}) {
    const navigate = useNavigate();
    const open = (query: string) => navigate(`${ROUTE.DOCS.COMMON}?${query}`);

    let categories = DOCS;
    if (categoryId) {
        const byId = DOCS.filter((category) => category.id === categoryId);
        if (byId.length > 0) categories = byId;
    }
    if (groupTitle) {
        const byGroup = categories
            .map((category) => ({
                ...category,
                groups: category.groups.filter((group) => group.title === groupTitle),
            }))
            .filter((category) => category.groups.length > 0);
        if (byGroup.length > 0) categories = byGroup;
    }
    const single = categories.length === 1;

    return (
        <section className={single ? "w-full" : "columns-1 gap-4 lg:columns-2 2xl:columns-3"}>
            {categories.map((category) => {
                const count = category.groups.reduce((sum, g) => sum + g.items.length, 0);
                return (
                    <Card key={category.id} className="mb-4 min-w-0 break-inside-avoid gap-4">
                        <CardHeader>
                            <button
                                className="group flex items-center gap-3 text-left cursor-pointer disabled:cursor-default"
                                disabled={single}
                                onClick={() => open(`cat=${encodeURIComponent(category.id)}`)}
                            >
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <category.icon className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <CardTitle className="group-enabled:group-hover:text-primary transition-colors">
                                        {category.title}
                                    </CardTitle>
                                    <span className="text-xs text-muted-foreground">
                                        {count} {plural(count, ["статья", "статьи", "статей"])}
                                    </span>
                                </span>
                                {!single && (
                                    <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                                )}
                            </button>
                        </CardHeader>
                        <CardContent className={single ? "grid gap-6 md:grid-cols-2" : "flex flex-col gap-4"}>
                            {category.source && (
                                <div className={single ? "md:col-span-2 max-w-md" : undefined}>
                                    <DocFile source={category.source} />
                                </div>
                            )}
                            {category.groups.map((group) => {
                                const items =
                                    single || group.items.length <= PREVIEW_LIMIT + 1
                                        ? group.items
                                        : group.items.slice(0, PREVIEW_LIMIT);
                                const rest = group.items.length - items.length;
                                return (
                                    <div key={group.title}>
                                        <p className="px-2 mb-1 text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
                                            {group.title}
                                        </p>
                                        <ul className="flex flex-col">
                                            {items.map((item) => (
                                                <li key={item.id}>
                                                    <button
                                                        className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm cursor-pointer transition-colors hover:bg-muted"
                                                        onClick={() => open(`doc=${item.id}`)}
                                                    >
                                                        <span className="min-w-0 flex-1">
                                                            {item.title}
                                                            {single && item.summary && (
                                                                <span className="block text-xs text-muted-foreground">
                                                                    {item.summary}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <ChevronRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                        {rest > 0 && (
                                            <button
                                                className="mt-1 px-2 text-xs font-medium text-primary hover:underline cursor-pointer"
                                                onClick={() =>
                                                    open(
                                                        `cat=${encodeURIComponent(category.id)}&grp=${encodeURIComponent(group.title)}`,
                                                    )
                                                }
                                            >
                                                Ещё {rest} →
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                );
            })}
        </section>
    )
}
