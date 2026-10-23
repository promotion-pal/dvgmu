import type { Metadata } from "next";
import { PageHeader } from "@/shared/components/page-header";
import { Section, Notice } from "@/shared/components/ui-bits";
import { doctors, doctorGroups, doctorsNote } from "@/shared/data/doctors";

export const metadata: Metadata = {
  title: "Врачи",
  description:
    "Медицинские работники консультативно-диагностической поликлиники «Клиника семейной медицины» ДВГМУ: врачи, средний медицинский персонал, квалификационные категории и учёные степени.",
};

export default function DoctorsPage() {
  return (
    <>
      <PageHeader
        title="Врачи"
        intro="Медицинские работники, участвующие в предоставлении медицинских услуг."
        crumbs={[{ title: "Врачи" }]}
      />

      <Section>
        <div className="mb-8 max-w-3xl">
          <Notice>{doctorsNote}</Notice>
        </div>

        <div className="space-y-12">
          {doctorGroups.map((group) => {
            const list = doctors.filter((d) => d.group === group);
            if (list.length === 0) return null;
            return (
              <div key={group}>
                <h2 className="text-xl font-semibold">{group}</h2>
                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((d) => (
                    <div
                      key={`${d.name}-${d.position}`}
                      className="rounded-xl border border-border bg-card p-5 shadow-sm"
                    >
                      <p className="font-semibold">{d.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{d.position}</p>
                      {(d.category || d.degree || d.title) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {[
                            d.category && `${d.category} квалификационная категория`,
                            d.degree,
                            d.title,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
