import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Reveal } from "@/shared/components/reveal";

type Crumb = { title: string; href?: string };

export function PageHeader({
  title,
  intro,
  crumbs = [],
}: {
  title: string;
  intro?: string;
  crumbs?: Crumb[];
}) {
  return (
    <section className="border-b border-border bg-linear-to-b from-primary/10 to-transparent">
      <div className="container mx-auto px-4 py-10 md:py-14">
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-primary">
            Главная
          </Link>
          {crumbs.map((c) => (
            <span key={c.title} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5" />
              {c.href ? (
                <Link href={c.href} className="hover:text-primary">
                  {c.title}
                </Link>
              ) : (
                <span className="text-foreground">{c.title}</span>
              )}
            </span>
          ))}
        </nav>
        <Reveal
          as="h1"
          className="max-w-3xl text-3xl font-bold text-balance break-words hyphens-auto md:text-4xl"
        >
          {title}
        </Reveal>
        {intro && (
          <Reveal
            as="p"
            delay={0.05}
            className="mt-4 max-w-2xl text-lg text-muted-foreground"
          >
            {intro}
          </Reveal>
        )}
      </div>
    </section>
  );
}
