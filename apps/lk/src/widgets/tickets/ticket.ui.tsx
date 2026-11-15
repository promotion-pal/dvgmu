import { useState, type FormEvent } from "react";
import { formatTicketDate } from "./ticket.utils";
import { useTickets } from "./ticket.fn";

export function TicketsWidget() {
  const { tickets, loading, saving, error, refetch, createTicket } = useTickets();
  const [title, setTitle] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createTicket(title.trim());
    if (created) setTitle("");
  }

  return (
    <main className="task-page">
      <section className="task-panel">
        <header className="task-header">
          <div className="task-mark" aria-hidden="true">Д</div>
          <div>
            <p className="task-eyebrow">ДВГМУ · Личный кабинет</p>
            <h1>Мои задачи</h1>
          </div>
        </header>

        <form className="task-form" onSubmit={submit}>
          <label htmlFor="task-title">Новая задача</label>
          <div className="task-form-row">
            <input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, подготовить документы"
              maxLength={200}
              required
            />
            <button type="submit" disabled={!title.trim() || saving}>
              {saving ? "Создаю…" : "Создать"}
            </button>
          </div>
        </form>

        {error && <p className="task-error" role="alert">Не удалось выполнить запрос</p>}

        <section className="task-list" aria-labelledby="task-list-title">
          <div className="task-list-heading">
            <h2 id="task-list-title">Список</h2>
            <span>{tickets.length}</span>
          </div>
          {loading ? (
            <p className="task-empty">Загружаю задачи…</p>
          ) : tickets.length === 0 ? (
            <p className="task-empty">Пока нет задач. Создайте первую.</p>
          ) : (
            <ul>
              {tickets.map((ticket) => (
                <li className="task-item" key={ticket.id}>
                  <span className="task-dot" aria-hidden="true" />
                  <span className="task-title">{ticket.title}</span>
                  <time dateTime={new Date(Number(ticket.createdAt) * 1000).toISOString()}>
                    {formatTicketDate(ticket.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
          {error && !loading && (
            <button className="task-retry" type="button" onClick={() => void refetch()}>
              Повторить загрузку
            </button>
          )}
        </section>
      </section>
    </main>
  );
}
