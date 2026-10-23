import { DocsSidebar, DocsItem, DocsList, findCategory, findDoc } from "@/widgets/docs";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb"
import { Button } from "@/shared/ui/button"
import { Separator } from "@/shared/ui/separator"
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
} from "@/shared/ui/sidebar"
import { ArrowLeftIcon } from "lucide-react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { ROUTE } from "@/shared/config/path"

function catHref(categoryId: string) {
    return `${ROUTE.DOCS.COMMON}?cat=${encodeURIComponent(categoryId)}`
}

function groupHref(categoryId: string, groupTitle: string) {
    return `${catHref(categoryId)}&grp=${encodeURIComponent(groupTitle)}`
}

export function DocsPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const doc = findDoc(searchParams.get("doc"))
    const catId = searchParams.get("cat")
    const grpTitle = searchParams.get("grp")

    const category = doc?.category ?? findCategory(catId)
    const groupTitle = doc?.group.title ?? grpTitle ?? null
    const group =
        category && groupTitle
            ? category.groups.find((g) => g.title === groupTitle) ?? null
            : null

    const showBack = Boolean(doc || category)

    return (
        <SidebarProvider>
            <DocsSidebar />

            <SidebarInset>
                <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" />
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden md:block">
                                {doc || category ? (
                                    <BreadcrumbLink asChild>
                                        <Link to={ROUTE.DOCS.COMMON}>Документы</Link>
                                    </BreadcrumbLink>
                                ) : (
                                    <BreadcrumbPage>Документы</BreadcrumbPage>
                                )}
                            </BreadcrumbItem>

                            {category && (
                                <>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem className="hidden md:block">
                                        {doc || group ? (
                                            <BreadcrumbLink asChild>
                                                <Link to={catHref(category.id)}>{category.title}</Link>
                                            </BreadcrumbLink>
                                        ) : (
                                            <BreadcrumbPage>{category.title}</BreadcrumbPage>
                                        )}
                                    </BreadcrumbItem>
                                </>
                            )}

                            {group && category && (
                                <>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem className={doc ? "hidden md:block" : undefined}>
                                        {doc ? (
                                            <BreadcrumbLink asChild>
                                                <Link to={groupHref(category.id, group.title)}>
                                                    {group.title}
                                                </Link>
                                            </BreadcrumbLink>
                                        ) : (
                                            <BreadcrumbPage>{group.title}</BreadcrumbPage>
                                        )}
                                    </BreadcrumbItem>
                                </>
                            )}

                            {doc && (
                                <>
                                    <BreadcrumbSeparator className="hidden md:block" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>{doc.entry.title}</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </>
                            )}
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                <div className="flex flex-1 flex-col gap-4 p-4">
                    {showBack && (
                        <div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="-ml-2.5"
                                onClick={() => navigate(-1)}
                            >
                                <ArrowLeftIcon className="size-4" />
                                Назад
                            </Button>
                        </div>
                    )}

                    {doc ? (
                        <DocsItem doc={doc} />
                    ) : (
                        <DocsList categoryId={catId} groupTitle={grpTitle} />
                    )}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
