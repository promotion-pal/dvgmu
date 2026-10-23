import { useEffect, useState } from "react";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { createClient } from "@connectrpc/connect";
import { toast } from "sonner";

import { connectTransport } from "@/shared/config/api";
import { useFetchState } from "@/features/lib/fetch";
import { useCommonModal } from "@/shared/components/modal";

import type { TicketBuild, TicketDormitory } from "@dvgmu/contract/packages/tasks/entity/ticket.entity_pb";
import type { TicketStatus } from "@dvgmu/contract/packages/tasks/enum/ticket.enum_pb";
import {
  TicketBuildService,
  TicketBuildCreateRequestSchema,
  TicketBuildFetchRequestSchema,
  TicketDormitoryService,
  TicketDormitoryCreateRequestSchema,
  TicketDormitoryFetchRequestSchema,
} from "@dvgmu/contract/packages/tasks/service/ticket.service_pb";

const dormitoryClient = createClient(TicketDormitoryService, connectTransport);
const buildClient = createClient(TicketBuildService, connectTransport);

const useDormitoryTicket = () => {
  const listState = useFetchState<TicketDormitory>();
  const singleState = useFetchState<TicketDormitory>();
  const modal = useCommonModal({});

  const [filter, setFilter] = useState<
    MessageInitShape<typeof TicketDormitoryFetchRequestSchema>
  >({});

  const fetch = async (
    query: MessageInitShape<typeof TicketDormitoryFetchRequestSchema> = filter,
  ) => {
    listState.setLoading(true);
    listState.setError(false);
    try {
      const res = await dormitoryClient.ticketDormitoryFetch(
        create(TicketDormitoryFetchRequestSchema, query),
      );
      listState.setList(res.tickets);
    } catch (error) {
      console.error("Ошибка при получении заявок по общежитиям:", error);
      listState.setError(true);
    } finally {
      listState.setLoading(false);
    }
  };

  useEffect(() => {
    fetch(filter);
  }, [filter]);

  const refetch = () => fetch(filter);

  const fetchByID = async (id: bigint) => {
    singleState.setActiveId(id);
    singleState.setLoading(true);
    singleState.setError(false);
    try {
      const res = await dormitoryClient.ticketDormitoryByID({ id });
      singleState.setItem(res.entity);
      return res.entity;
    } catch (error) {
      console.error("Ошибка при получении заявки:", error);
      singleState.setError(true);
      toast.error("Не удалось загрузить заявку");
    } finally {
      singleState.setLoading(false);
    }
  };

  const createTicket = async (
    payload: MessageInitShape<typeof TicketDormitoryCreateRequestSchema>,
  ) => {
    const res = await dormitoryClient.ticketDormitoryCreate(
      create(TicketDormitoryCreateRequestSchema, payload),
    );
    if (!res.success) {
      toast.error(res.message || "Не удалось создать заявку");
      return null;
    }
    toast.success("Заявка создана");
    modal.closeModal();
    await refetch();
    return res;
  };

  const changeStatus = async (id: bigint, newStatus: TicketStatus) => {
    const res = await dormitoryClient.ticketDormitoryChangeStatus({ id, newStatus });
    if (!res.success) {
      toast.error(res.message || "Не удалось изменить статус");
      return;
    }
    toast.success("Статус обновлён");
    await refetch();
  };

  return {
    ticketRes: {
      fetch,
      refetch,
      filter,
      setFilter,

      list: listState.list,
      loading: listState.loading,
      error: listState.error,
      empty: listState.empty,

      item: singleState.item,
      activeId: singleState.activeId,
      loadingSingle: singleState.loading,
      errorSingle: singleState.error,
      fetchByID,

      createTicket,
      changeStatus,
    },
    ticketModal: modal,
  };
};

const useBuildTicket = () => {
  const listState = useFetchState<TicketBuild>();
  const singleState = useFetchState<TicketBuild>();
  const modal = useCommonModal({});

  const [filter, setFilter] = useState<
    MessageInitShape<typeof TicketBuildFetchRequestSchema>
  >({});

  const fetch = async (
    query: MessageInitShape<typeof TicketBuildFetchRequestSchema> = filter,
  ) => {
    listState.setLoading(true);
    listState.setError(false);
    try {
      const res = await buildClient.ticketBuildFetch(
        create(TicketBuildFetchRequestSchema, query),
      );
      listState.setList(res.tickets);
    } catch (error) {
      console.error("Ошибка при получении заявок по корпусам:", error);
      listState.setError(true);
    } finally {
      listState.setLoading(false);
    }
  };

  useEffect(() => {
    fetch(filter);
  }, [filter]);

  const refetch = () => fetch(filter);

  const fetchByID = async (id: bigint) => {
    singleState.setActiveId(id);
    singleState.setLoading(true);
    singleState.setError(false);
    try {
      const res = await buildClient.ticketBuildByID({ id });
      singleState.setItem(res.entity);
      return res.entity;
    } catch (error) {
      console.error("Ошибка при получении заявки:", error);
      singleState.setError(true);
      toast.error("Не удалось загрузить заявку");
    } finally {
      singleState.setLoading(false);
    }
  };

  const createTicket = async (
    payload: MessageInitShape<typeof TicketBuildCreateRequestSchema>,
  ) => {
    const res = await buildClient.ticketBuildCreate(
      create(TicketBuildCreateRequestSchema, payload),
    );
    if (!res.success) {
      toast.error(res.message || "Не удалось создать заявку");
      return null;
    }
    toast.success("Заявка создана");
    modal.closeModal();
    await refetch();
    return res;
  };

  const changeStatus = async (id: bigint, newStatus: TicketStatus) => {
    const res = await buildClient.ticketBuildChangeStatus({ id, newStatus });
    if (!res.success) {
      toast.error(res.message || "Не удалось изменить статус");
      return;
    }
    toast.success("Статус обновлён");
    await refetch();
  };

  return {
    ticketRes: {
      fetch,
      refetch,
      filter,
      setFilter,

      list: listState.list,
      loading: listState.loading,
      error: listState.error,
      empty: listState.empty,

      item: singleState.item,
      activeId: singleState.activeId,
      loadingSingle: singleState.loading,
      errorSingle: singleState.error,
      fetchByID,

      createTicket,
      changeStatus,
    },
    ticketModal: modal,
  };
};

export { useDormitoryTicket, useBuildTicket };
