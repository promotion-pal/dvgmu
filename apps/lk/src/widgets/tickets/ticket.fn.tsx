import { useEffect, useState } from "react";
import { createTask, listTasks, type TaskItem } from "@/features/tasks/api";
import { useFetchState } from "@/features/lib/fetch";
import { useUserProvider, userHasPermission } from "@/features/provider/user.provider";
import { UserPermission } from "@fesmu/contract/mdm/enum/user.enum_pb";

export function useTickets() {
  const user = useUserProvider((state) => state.user);
  const canRead = userHasPermission(user, UserPermission.USER_TASK_READ);
  const canCreate = userHasPermission(user, UserPermission.USER_TASK_CREATE);
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
      if (!canRead || !user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(false);
      try {
        const result = await listTasks(user.id);
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
  }, [canRead, user, setError, setList, setLoading]);

  const refetch = async () => {
    if (!canRead || !user) return;
    setLoading(true);
    setError(false);
    try {
      setList(await listTasks(user.id));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (title: string) => {
    if (!canCreate || !user) return null;
    setSaving(true);
    setError(false);
    try {
      const ticket = await createTask(title, user.id);
      setList((current) => [ticket, ...current]);
      return ticket;
    } catch {
      setError(true);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { tickets, loading, saving, error, refetch, createTicket, canRead, canCreate };
}
