import { Link, Outlet } from "react-router-dom";
import { BookOpenTextIcon, LogInIcon } from "lucide-react";
import { appConfig } from "@/shared/config/app";
import { ROUTE } from "@/shared/config/path";
import { Button } from "@/shared/ui/button";
import { Footer } from "./footer";

/* Каркас открытых разделов сайта (методички): шапка той же высоты, что в
 * кабинете (h-16, на неё рассчитаны липкие панели читалки), без меню
 * разделов; вход — в личный кабинет. */
export const PublicLayout = () => (
    <div className="flex min-h-screen w-full flex-col bg-background">
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
            <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-6">
                <Link to={ROUTE.PUBLIC.MANUALS} className="flex items-center gap-2">
                    <span className="text-sm font-semibold uppercase tracking-wide text-foreground/60">{appConfig.name}</span>
                    <span className="font-light text-muted-foreground/30">/</span>
                    <span className="flex items-center gap-1.5 text-base font-bold tracking-tight">
                        <BookOpenTextIcon className="size-4" />
                        Методички
                    </span>
                </Link>
                <Button variant="outline" size="sm" asChild>
                    <Link to={ROUTE.HOME}>
                        <LogInIcon />
                        Личный кабинет
                    </Link>
                </Button>
            </div>
        </header>
        <main className="flex min-w-0 flex-1 items-stretch justify-center">
            <Outlet />
        </main>
        <Footer />
    </div>
);
