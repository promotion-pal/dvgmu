'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Calendar, Menu, Phone, Stethoscope, X } from "lucide-react";
import { appConfig, primaryNav } from "@/shared/config/app";
import { cn } from "@/shared/lib/utils";

const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile menu on navigation — state adjustment during render.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Stethoscope className="h-7 w-7 text-primary" />
          <span className="text-base font-bold sm:text-lg">{appConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm xl:flex">
          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors hover:text-primary",
                isActive(item.href)
                  ? "font-medium text-primary"
                  : "text-muted-foreground",
              )}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={tel(appConfig.phones[0].number)}
            className="hidden items-center gap-2 text-sm font-medium text-foreground sm:flex"
          >
            <Phone className="h-4 w-4 text-primary" />
            {appConfig.phones[0].number}
          </a>
          <Link
            href="/appointment"
            className="hidden items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 sm:flex"
          >
            <Calendar className="h-4 w-4" />
            Записаться
          </Link>
          <button
            type="button"
            aria-label="Меню"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border xl:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border xl:hidden">
          <div className="container mx-auto flex flex-col px-4 py-2">
            {primaryNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-b border-border/60 py-3 text-sm last:border-0",
                  isActive(item.href)
                    ? "font-medium text-primary"
                    : "text-muted-foreground",
                )}
              >
                {item.title}
              </Link>
            ))}
            <Link
              href="/appointment"
              className="mt-3 mb-2 inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
            >
              <Calendar className="h-4 w-4" />
              Записаться на приём
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
