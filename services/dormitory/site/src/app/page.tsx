import Link from "next/link";

import { DutyRegistrationBlock } from "@/shared/models/dormitory";

export default function Index() {
  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 sm:py-12">
        <header>
          <h1 className="h1">Запись на дежурство</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Курс — по номеру группы, факультет — по зачётке, этаж — по комнате
          </p>
          <Link
            href="/guide"
            className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Как заполнить форму →
          </Link>
        </header>

        <DutyRegistrationBlock />
      </div>
    </main>
  );
}
