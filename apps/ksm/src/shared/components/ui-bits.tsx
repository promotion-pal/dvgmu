import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Section({
  children,
  className,
  muted,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section className={cn("py-12 md:py-16", muted && "bg-muted", className)}>
      <div className="container mx-auto px-4">{children}</div>
    </section>
  );
}

export function SectionTitle({
  children,
  center,
}: {
  children: ReactNode;
  center?: boolean;
}) {
  return (
    <h2 className={cn("text-2xl font-bold md:text-3xl", center && "text-center")}>
      {children}
    </h2>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-6 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function LinkCard({
  href,
  title,
  description,
  external,
}: {
  href: string;
  title: string;
  description?: string;
  external?: boolean;
}) {
  const inner = (
    <>
      <span className="text-lg font-semibold">{title}</span>
      {description && (
        <span className="mt-2 text-sm text-muted-foreground">{description}</span>
      )}
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
        Подробнее
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </>
  );

  const className =
    "group flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md";

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

export function Prose({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="space-y-4 text-muted-foreground">
      {paragraphs.map((p, i) =>
        p.startsWith("## ") ? (
          <h3 key={i} className="pt-2 text-lg font-semibold text-foreground">
            {p.replace("## ", "")}
          </h3>
        ) : (
          <p key={i}>{p}</p>
        ),
      )}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
