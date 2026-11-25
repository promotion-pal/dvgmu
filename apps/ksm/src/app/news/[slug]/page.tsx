import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";
import { news, getNews, formatDate } from "@/shared/data/news";

export function generateStaticParams() {
  return news.map((n) => ({ slug: n.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const item = getNews(slug);
  if (!item) return {};
  return { title: item.title, description: item.summary };
}

export default async function NewsItemPage({ params }: Params) {
  const { slug } = await params;
  const item = getNews(slug);
  if (!item) notFound();

  return (
    <>
      <PageHeader
        title={item.title}
        crumbs={[{ title: "Новости", href: "/news" }, { title: item.title }]}
      />

      <Section>
        <article className="mx-auto max-w-2xl">
          <p className="text-sm font-medium text-primary">{formatDate(item.date)}</p>
          <div className="mt-4 space-y-4 text-muted-foreground">
            {item.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-8 text-sm text-muted-foreground">
            Источник:{" "}
            <a
              href={appConfig.source}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary"
            >
              официальный сайт клиника-дв.рф
            </a>
          </p>
          <Link
            href="/news"
            className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Ко всем новостям
          </Link>
        </article>
      </Section>
    </>
  );
}
