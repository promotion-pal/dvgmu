import { Link, useLocation } from "react-router-dom";
import type { ComponentProps } from "react";
import { CircleUserIcon, LogOutIcon, TerminalIcon } from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/shared/ui/sidebar";
import { appConfig } from "@/shared/config/app";
import { ROUTE } from "@/shared/config/path";
import { signOut } from "@/shared/config/session";
import { visibleGroups } from "./nav";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { useUserProvider } from "@/features/provider/user.provider";

export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
    const location = useLocation();
    const hasRole = useUserProvider((s) => s.hasRole);
    const hasPermission = useUserProvider((s) => s.hasPermission);
    const profile = useUserProvider((s) => s.profile);

    const groups = visibleGroups(hasRole, hasPermission);
    const userName = profile ? `${profile.lastName} ${profile.firstName}`.trim() || profile.username : "";

    return (
        <TooltipProvider>
        <Sidebar {...props}>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link to={ROUTE.HOME}>
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                                    <TerminalIcon className="size-4" />
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{appConfig.name}</span>
                                    <span className="truncate text-xs">{appConfig.fullName}</span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {groups.map((group) => (
                    <SidebarGroup key={group.label}>
                        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                        <SidebarMenu>
                            {group.items.map((item) => (
                                <SidebarMenuItem key={item.url}>
                                    <SidebarMenuButton asChild isActive={location.pathname === item.url || (!item.exact && location.pathname.startsWith(`${item.url}/`))} tooltip={item.title}>
                                        <Link to={item.url}>
                                            <item.icon className="size-4" />
                                            <span>{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroup>
                ))}
            </SidebarContent>

            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.pathname === ROUTE.USER.PROFILE} tooltip="Профиль">
                            <Link to={ROUTE.USER.PROFILE}>
                                <CircleUserIcon className="size-4" />
                                <span className="truncate">{userName || "Профиль"}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={signOut} tooltip="Выйти">
                            <LogOutIcon className="size-4" />
                            <span>Выйти</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
        </TooltipProvider>
    );
}
