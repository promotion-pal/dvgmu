import { Navigate, Route, Routes } from "react-router";
import { TicketsWidget } from "@/widgets/tickets";
import { ROUTER } from "@/shared/config/path";

export function IndexPage() {
  return (
    <Routes>
      <Route path={ROUTER.PATH.INDEX} element={<Navigate to={ROUTER.PATH.TASKS} replace />} />
      <Route path={ROUTER.PATH.TASKS} element={<TicketsWidget />} />
      <Route path={ROUTER.PATH.EDUCATION} element={<SectionPage title="Обучение" />} />
      <Route path={ROUTER.PATH.DOCUMENTS} element={<SectionPage title="Документы" />} />
      <Route path={ROUTER.PATH.NOT_FOUND} element={<SectionPage title="Страница не найдена" />} />
    </Routes>
  );
}

function SectionPage({ title }: { title: string }) {
  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 text-slate-800 sm:px-6 sm:py-14">
      <section className="mx-auto w-full max-w-[720px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="mb-2 text-sm font-medium text-blue-700">Личный кабинет ДВГМУ</p>
        <h1 className="m-0 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Раздел пока находится в разработке.
        </p>
      </section>
    </main>
  );
}
