import { useEffect, useState } from "react";
import { createTask, listTasks, type TaskItem } from "@/features/tasks/api";
import { useFetchState } from "@/features/lib/fetch";

export function useTickets() {
  const {
    list: tickets,
    loading,
    error,
    setList,
    setLoading,
    setError,
  } = useFetchState<TaskItem>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTickets() {
      setLoading(true);
      setError(false);
      try {
        const result = await listTasks();
        if (active) setList(result);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTickets();
    return () => {
      active = false;
    };
  }, [setError, setList, setLoading]);

  const refetch = async () => {
    setLoading(true);
    setError(false);
    try {
      setList(await listTasks());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (title: string) => {
    setSaving(true);
    setError(false);
    try {
      const ticket = await createTask(title);
      setList((current) => [ticket, ...current]);
      return ticket;
    } catch {
      setError(true);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { tickets, loading, saving, error, refetch, createTicket };
}
