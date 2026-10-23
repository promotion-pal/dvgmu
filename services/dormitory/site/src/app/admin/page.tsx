import Link from "next/link";

import { AdminGate } from "@/shared/components/admin-gate";
import { DutyRegistrationsByFloor } from "@/shared/models/dormitory";

export default function Admin() {
  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="h1">Записанные на дежурство</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Студенты, сгруппированные по этажам
            </p>
          </div>
          <Link
            href="/"
            className="shrink-0 text-sm text-primary underline-offset-4 hover:underline"
          >
            К форме записи
          </Link>
        </header>

        <AdminGate>
          <DutyRegistrationsByFloor />
        </AdminGate>
      </div>
    </main>
  );
}
