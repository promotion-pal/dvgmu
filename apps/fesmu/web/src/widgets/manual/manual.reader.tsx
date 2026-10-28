import { useEffect, useState } from "react";
import type { FC } from "react";
import { Link, generatePath } from "react-router-dom";
import { PencilIcon } from "lucide-react";
import { Can } from "@/features/access";
import { libraryApi } from "@/features/library";
import type { LibraryItem, Manual } from "@/features/library";
import { CommonControlState } from "@/shared/components/state/control-state";
import { PermissionSection } from "@/shared/config/permissions";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { BlocksReader } from "@/widgets/reader";
import { useReadEnv } from "./manual.env";
import { manualMeta } from "./manual.lib";

const NO_LITERATURE: LibraryItem[] = [];

interface ManualReaderProps {
    id: string;
    /** Предпросмотр черновика (manuals.post): позиция чтения не сохраняется. */
    draft?: boolean;
    /** Открытая страница без входа: назад — к открытому списку, позиция не сохраняется. */
    open?: boolean;
}

/** Методичка в читалке — в кабинете и на открытой странице. */
export const ManualReader: FC<ManualReaderProps> = ({ id, draft = false, open = false }) => {
    // Ответ помнит, для чего он: при переходе к другой методичке старое не показываем.
    const key = `${id}-${draft}`;
    const [loaded, setLoaded] = useState<{ key: string; data?: { manual: Manual; literature: LibraryItem[] }; error?: boolean }>();
    const data = loaded?.key === key ? loaded.data : undefined;
    const error = loaded?.key === key && Boolean(loaded.error);
    const env = useReadEnv(data?.literature ?? NO_LITERATURE);

    useEffect(() => {
        libraryApi.manual(id, draft).then(
            (d) => setLoaded({ key, data: d }),
            () => setLoaded({ key, error: true }),
        );
    }, [id, draft, key]);

    if (!data) return <CommonControlState isLoading={!error} isError={error} isEmpty={false} styleWrapper="w-full p-6" />;
    const { manual } = data;
    const editHref = generatePath(ROUTE.LIBRARY.MANUAL_EDIT, { id });
    const listHref = open ? ROUTE.PUBLIC.MANUALS : ROUTE.LIBRARY.MANUALS;

    return (
        <BlocksReader
            key={key}
            refId={draft || open ? undefined : id}
            title={manual.title}
            subtitle={[manual.discipline, manualMeta(manual)].filter(Boolean).join(" · ")}
            backHref={draft ? editHref : listHref}
            backLabel={draft ? "В редактор" : "К методичкам"}
            sections={manual.sections}
            env={env}
            notice={draft && <div className="border-b bg-amber-500/10 px-6 py-2 text-sm text-amber-700 dark:text-amber-400">Предпросмотр черновика — студенты видят опубликованную версию.</div>}
            tools={
                !draft && (
                    <Can section={PermissionSection.MANUALS}>
                        <Button variant="ghost" size="icon-sm" asChild aria-label="Править"><Link to={editHref}><PencilIcon /></Link></Button>
                    </Can>
                )
            }
            header={
                <header className="mb-10">
                    <div className="text-sm text-muted-foreground">{manual.discipline}</div>
                    <h1 className="mt-1 text-3xl font-bold leading-tight">{manual.title}</h1>
                    {manual.authors && <div className="mt-2 text-muted-foreground">{manual.authors}</div>}
                    {manual.annotation && <p className="mt-4 leading-relaxed">{manual.annotation}</p>}
                </header>
            }
        />
    );
};
