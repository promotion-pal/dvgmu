import { useState, type FormEvent } from "react";
import { formatTicketDate } from "./ticket.utils";
import { useTickets } from "./ticket.fn";
import { Card } from "@/shared/ui/card";

export function TicketsWidget() {
  const { tickets, loading, saving, error, refetch, createTicket } = useTickets();
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createTicket(title.trim());
    if (created) setTitle("");
  }

  return (
    <main className="min-h-screen bg-slate-100 px-3 py-5 text-left text-slate-800 sm:px-6 sm:py-14">
      <Card className="mx-auto box-border w-full max-w-[720px] p-5 sm:p-9">
        <header className="mb-8 flex items-center gap-4 sm:mb-9">
          <div className="grid size-[52px] shrink-0 place-items-center rounded-[15px] bg-blue-50 text-[25px] font-bold text-blue-700" aria-hidden="true">Д</div>
          <div>
            <p className="mb-1 text-[13px] text-slate-500">ДВГМУ · Личный кабинет</p>
            <h1 className="m-0 text-[25px] font-semibold tracking-[-0.6px] text-slate-900 sm:text-[30px]">Мои задачи</h1>
          </div>
        </header>

        <form onSubmit={submit}>
          <label className="mb-2.5 block text-sm font-semibold text-slate-700" htmlFor="task-title">Новая задача</label>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-[10px] border border-slate-300 bg-white px-[15px] py-[13px] text-[15px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-[3px] focus:ring-blue-500/15"
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, подготовить документы"
              maxLength={200}
              required
            />
            <button className="min-h-[46px] rounded-[10px] bg-blue-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:min-h-0" type="submit" disabled={!title.trim() || saving}>
              {saving ? "Создаю…" : "Создать"}
            </button>
          </div>
        </form>

        {error && <p className="mt-3.5 text-sm text-red-700" role="alert">Не удалось выполнить запрос</p>}

        <section className="mt-9" aria-labelledby="task-list-title">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <h2 className="m-0 text-[17px] font-semibold text-slate-900" id="task-list-title">Список</h2>
            <span className="grid size-6 place-items-center rounded-full bg-slate-100 px-1 text-xs text-slate-600">{tickets.length}</span>
          </div>
          {loading ? (
            <p className="py-6 text-sm text-slate-500">Загружаю задачи…</p>
          ) : tickets.length === 0 ? (
            <p className="py-6 text-sm text-slate-500">Пока нет задач. Создайте первую.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {tickets.map((ticket) => (
                <li className="flex min-h-[58px] items-center gap-3 border-b border-slate-100" key={ticket.id}>
                  <span className="size-[9px] shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-[15px] text-slate-800">{ticket.title}</span>
                  <time className="whitespace-nowrap text-xs text-slate-400" dateTime={new Date(Number(ticket.createdAt) * 1000).toISOString()}>
                    {formatTicketDate(ticket.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
          {error && !loading && (
            <button className="mt-4 rounded-md px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" type="button" onClick={() => void refetch()}>
              Повторить загрузку
            </button>
          )}
        </section>
      </Card>
    </main>
  );
}
