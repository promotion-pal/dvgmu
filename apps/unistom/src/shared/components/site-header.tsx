'use client'

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Calendar, Menu, Phone, X } from "lucide-react";
import { FaTeethOpen } from "react-icons/fa";
import { appConfig, primaryNav } from "@/shared/config/app";
import { cn } from "@/shared/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <motion.header
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md"
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <FaTeethOpen className="h-7 w-7 text-primary" />
          <span className="text-lg font-bold sm:text-xl">{appConfig.name}</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm lg:flex">
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
            href={`tel:${appConfig.phones.registry[0].replace(/[^\d+]/g, "")}`}
            className="hidden items-center gap-2 text-sm font-medium text-foreground sm:flex"
          >
            <Phone className="h-4 w-4 text-primary" />
            {appConfig.phones.registry[0]}
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
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden border-t border-border lg:hidden"
          >
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
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
