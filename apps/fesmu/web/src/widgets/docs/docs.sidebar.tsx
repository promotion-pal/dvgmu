import * as React from "react"

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/ui/collapsible"
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarRail,
} from "@/shared/ui/sidebar"
import { BookOpenIcon, PlusIcon, MinusIcon } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ROUTE } from "@/shared/config/path"
import { DOCS } from "./docs.data"

export function DocsSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const [searchParams] = useSearchParams()
    const activeId = searchParams.get("doc")
    const navigate = useNavigate()

    return (
        <Sidebar {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            onClick={() => navigate(ROUTE.DOCS.COMMON)}
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                <BookOpenIcon className="size-4" />
                            </div>
                            <div className="flex flex-col gap-0.5 leading-none">
                                <span className="font-medium">Документы</span>
                                <span className="">ДВГМУ</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {DOCS.map((category) => {
                    const isCategoryActive = category.groups.some((group) =>
                        group.items.some((item) => item.id === activeId),
                    )

                    return (
                        <SidebarGroup key={category.id}>
                            <SidebarMenu>
                                <Collapsible
                                    defaultOpen={isCategoryActive || true}
                                    className="group/collapsible"
                                >
                                    <SidebarMenuItem>
                                        <CollapsibleTrigger asChild>
                                            <SidebarMenuButton>
                                                <category.icon className="size-4" />
                                                {category.title}
                                                <PlusIcon className="ml-auto group-data-[state=open]/collapsible:hidden" />
                                                <MinusIcon className="ml-auto group-data-[state=closed]/collapsible:hidden" />
                                            </SidebarMenuButton>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <SidebarMenuSub className="border-l-0 px-0 mx-0">
                                                {category.groups.map((group) => (
                                                    <React.Fragment key={group.title}>
                                                        <li className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground/80 uppercase tracking-wide">
                                                            {group.title}
                                                        </li>
                                                        {group.items.map((item) => (
                                                            <SidebarMenuSubItem key={item.id}>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    isActive={item.id === activeId}
                                                                    className="h-auto min-h-7 items-start whitespace-normal py-1.5 leading-snug"
                                                                >
                                                                    <a
                                                                        href={`${ROUTE.DOCS.COMMON}?doc=${item.id}`}
                                                                        onClick={(e) => {
                                                                            e.preventDefault()
                                                                            navigate(`${ROUTE.DOCS.COMMON}?doc=${item.id}`)
                                                                        }}
                                                                    >
                                                                        {item.title}
                                                                    </a>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                        ))}
                                                    </React.Fragment>
                                                ))}
                                            </SidebarMenuSub>
                                        </CollapsibleContent>
                                    </SidebarMenuItem>
                                </Collapsible>
                            </SidebarMenu>
                        </SidebarGroup>
                    )
                })}
            </SidebarContent>
            <SidebarRail />
        </Sidebar>
    )
}
