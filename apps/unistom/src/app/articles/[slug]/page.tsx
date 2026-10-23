import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Reveal } from "@/shared/components/reveal";
import { Section, Prose } from "@/shared/components/ui-bits";
import { articles } from "@/shared/data/articles";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) return {};
  return { title: article.title, description: article.summary };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = articles.find((a) => a.slug === slug);
  if (!article) notFound();

  return (
    <>
      <PageHeader
        title={article.title}
        intro={article.summary}
        crumbs={[{ title: "Статьи", href: "/articles" }, { title: article.title }]}
      />

      <Section>
        <Reveal className="mx-auto max-w-3xl">
          <Prose paragraphs={article.body} />

          <Link
            href="/articles"
            className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Все статьи
          </Link>
        </Reveal>
      </Section>
    </>
  );
}
