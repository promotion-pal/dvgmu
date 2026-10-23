import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Check, Phone } from "lucide-react";
import { PageHeader } from "@/shared/components/page-header";
import { Section } from "@/shared/components/ui-bits";
import { Prose } from "@/shared/components/ui-bits";
import { appConfig } from "@/shared/config/app";
import { programs, getProgram } from "@/shared/data/programs";

export function generateStaticParams() {
  return programs.map((p) => ({ slug: p.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const program = getProgram(slug);
  if (!program) return {};
  return { title: program.name, description: program.summary };
}

export default async function ProgramPage({ params }: Params) {
  const { slug } = await params;
  const program = getProgram(slug);
  if (!program) notFound();

  return (
    <>
      <PageHeader
        title={program.name}
        intro={program.summary}
        crumbs={[
          { title: "Программы", href: "/programs" },
          { title: program.name },
        ]}
      />

      <Section>
        <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {program.kind}
        </span>
        <div className="mt-6 max-w-3xl">
          <Prose paragraphs={program.body} />
        </div>

        {program.includes && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold">Что входит в программу</h2>
            <ul className="mt-4 space-y-2">
              {program.includes.map((i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {program.prices && (
          <div className="mt-10">
            <h2 className="text-xl font-semibold">Стоимость</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-sm">
                <tbody>
                  {program.prices.map((p) => (
                    <tr key={p.name} className="border-b border-border">
                      <td className="py-3 pr-4 text-muted-foreground">{p.name}</td>
                      <td className="py-3 text-right font-semibold whitespace-nowrap">
                        {p.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Цены приведены для ориентира. Актуальную стоимость уточняйте в
              регистратуре; полный прейскурант —{" "}
              <a
                href={appConfig.priceListUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary"
              >
                в PDF-прайсе
              </a>
              .
            </p>
          </div>
        )}

        {program.disclaimer && (
          <div className="mt-10 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/5 p-5 text-sm text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p>Имеются противопоказания, необходима консультация специалиста.</p>
          </div>
        )}

        <div className="mt-10 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Запись на программу</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Регистратура: {appConfig.phones[0].number}, {appConfig.phones[1].number}.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/appointment"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            >
              Оставить заявку онлайн
            </Link>
            <a
              href={`tel:${appConfig.phones[0].number.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4" />
              Позвонить
            </a>
          </div>
        </div>
      </Section>
    </>
  );
}
