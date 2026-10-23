import type { FC } from "react";
import { useState } from "react";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import type { Timestamp } from "@bufbuild/protobuf/wkt";

import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { CommonModal } from "@/shared/components/modal";
import { CommonPopover } from "@/shared/components/menu";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/utils";
import { formatDate } from "@/features/utils/date";

import { TicketStatus, TicketType } from "@dvgmu/contract/packages/tasks/enum/ticket.enum_pb";
import type { TicketBuild, TicketDormitory } from "@dvgmu/contract/packages/tasks/entity/ticket.entity_pb";

import { useBuildTicket, useDormitoryTicket } from "./ticket.fn";
import {
  extractLocationBuild,
  extractLocationDormitory,
  extractTicketStatus,
  extractTicketType,
} from "./ticket.utils";

type Option = { value: number; label: string };
const labelOf = (opts: Option[], value: number) =>
  opts.find((o) => o.value === value)?.label ?? "—";

const STATUS_STYLE: Record<number, string> = {
  [TicketStatus.PENDING]: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  [TicketStatus.APPROVED]: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  [TicketStatus.REJECTED]: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

const TicketStatusBadge = ({ status }: { status: TicketStatus }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
      STATUS_STYLE[status] ?? "bg-muted text-muted-foreground",
    )}
  >
    {labelOf(extractTicketStatus, status)}
  </span>
);

// --- one ticket card -------------------------------------------------------

interface TicketCardProps {
  id: bigint;
  room: number;
  locationLabel: string;
  type: TicketType;
  status: TicketStatus;
  comment: string;
  createdAt?: Timestamp;
  onChangeStatus: (id: bigint, next: TicketStatus) => void;
}

const TicketCard: FC<TicketCardProps> = ({
  id,
  room,
  locationLabel,
  type,
  status,
  comment,
  createdAt,
  onChangeStatus,
}) => (
  <div className="flex flex-col gap-2 rounded-xl border p-4">
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col">
        <p className="font-semibold">
          {locationLabel} · комн. {room || "—"}
        </p>
        <p className="text-xs text-muted-foreground">
          {labelOf(extractTicketType, type)} · {formatDate("date", createdAt)}
        </p>
      </div>

      {status === TicketStatus.PENDING && (
        <CommonPopover
          items={[
            {
              label: "Одобрить",
              icon: <CheckIcon className="h-3.5 w-3.5" />,
              onClick: () => onChangeStatus(id, TicketStatus.APPROVED),
            },
            {
              label: "Отклонить",
              icon: <XIcon className="h-3.5 w-3.5" />,
              style: "text-destructive hover:text-destructive",
              onClick: () => onChangeStatus(id, TicketStatus.REJECTED),
            },
          ]}
        />
      )}
    </div>

    <TicketStatusBadge status={status} />

    {comment && <p className="text-sm text-muted-foreground">{comment}</p>}
  </div>
);

// --- create form ----------------------------------------------------------

interface TicketCreateFormProps {
  locations: Option[];
  onSubmit: (data: {
    room: number;
    location: number;
    type: TicketType;
    comment: string;
  }) => void | Promise<unknown>;
}

const TicketCreateForm: FC<TicketCreateFormProps> = ({ locations, onSubmit }) => {
  const [room, setRoom] = useState("");
  const [location, setLocation] = useState<number>(locations[0]?.value ?? 0);
  const [type, setType] = useState<TicketType>(extractTicketType[0]?.value ?? TicketType.PLUMBER);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ room: Number(room) || 0, location, type, comment });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Комната №
          <Input
            value={room}
            onChange={(e) => setRoom(e.target.value.replace(/\D/g, ""))}
            placeholder="314"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Локация
          <select
            value={location}
            onChange={(e) => setLocation(Number(e.target.value))}
            className="rounded-lg border bg-background px-3 py-2"
          >
            {locations.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Тип
        <select
          value={type}
          onChange={(e) => setType(Number(e.target.value) as TicketType)}
          className="rounded-lg border bg-background px-3 py-2"
        >
          {extractTicketType.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Комментарий
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Опишите проблему"
          rows={3}
        />
      </label>

      <Button onClick={submit} disabled={busy} className="self-start px-6">
        {busy ? "Создание…" : "Создать заявку"}
      </Button>
    </div>
  );
};

// --- boards --------------------------------------------------------------

interface BoardShellProps {
  title: string;
  loading: boolean;
  error: boolean;
  empty: boolean;
  retry: () => void;
  status: number | "all";
  onStatusChange: (v: number | "all") => void;
  onCreate: () => void;
  children: React.ReactNode;
  modalOpen: boolean;
  onModalOpenChange: (o: boolean) => void;
  form: React.ReactNode;
}

const BoardShell: FC<BoardShellProps> = ({
  title,
  loading,
  error,
  empty,
  retry,
  status,
  onStatusChange,
  onCreate,
  children,
  modalOpen,
  onModalOpenChange,
  form,
}) => (
  <CommonWrapper
    title={title}
    action={
      <Button size="sm" variant="outline" onClick={onCreate}>
        <PlusIcon className="size-3.5" />
        Заявка
      </Button>
    }
  >
    <div className="mb-4">
      <select
        value={String(status)}
        onChange={(e) =>
          onStatusChange(e.target.value === "all" ? "all" : Number(e.target.value))
        }
        className="rounded-lg border bg-background px-3 py-2 text-sm"
      >
        <option value="all">Все статусы</option>
        {extractTicketStatus.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>

    <CommonControlState
      isLoading={loading}
      isError={error}
      isEmpty={empty}
      error={<CommonServiceError service="задач" onRetry={retry} />}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </CommonControlState>

    <CommonModal
      open={modalOpen}
      onOpenChange={onModalOpenChange}
      title="Новая заявка"
      description="Заявка уйдёт в сервис задач и появится в списке."
    >
      {form}
    </CommonModal>
  </CommonWrapper>
);

export const DormitoryTicketBoard = ({ userId }: { userId?: bigint }) => {
  const { ticketRes, ticketModal } = useDormitoryTicket();
  const [status, setStatus] = useState<number | "all">("all");

  const applyStatus = (v: number | "all") => {
    setStatus(v);
    ticketRes.setFilter({ status: v === "all" ? undefined : (v as TicketStatus) });
  };

  return (
    <BoardShell
      title="Заявки по общежитиям"
      loading={ticketRes.loading}
      error={ticketRes.error}
      empty={ticketRes.empty}
      retry={ticketRes.refetch}
      status={status}
      onStatusChange={applyStatus}
      onCreate={() => ticketModal.openModal("create")}
      modalOpen={ticketModal.open}
      onModalOpenChange={ticketModal.onOpenChange}
      form={
        <TicketCreateForm
          locations={extractLocationDormitory}
          onSubmit={(d) =>
            ticketRes.createTicket({ userId: userId ?? 0n, ...d })
          }
        />
      }
    >
      {ticketRes.list.map((t: TicketDormitory) => (
        <TicketCard
          key={t.id.toString()}
          id={t.id}
          room={t.room}
          locationLabel={labelOf(extractLocationDormitory, t.location)}
          type={t.type}
          status={t.status}
          comment={t.comment}
          createdAt={t.createdAt}
          onChangeStatus={ticketRes.changeStatus}
        />
      ))}
    </BoardShell>
  );
};

export const BuildTicketBoard = ({ userId }: { userId?: bigint }) => {
  const { ticketRes, ticketModal } = useBuildTicket();
  const [status, setStatus] = useState<number | "all">("all");

  const applyStatus = (v: number | "all") => {
    setStatus(v);
    ticketRes.setFilter({ status: v === "all" ? undefined : (v as TicketStatus) });
  };

  return (
    <BoardShell
      title="Заявки по учебным корпусам"
      loading={ticketRes.loading}
      error={ticketRes.error}
      empty={ticketRes.empty}
      retry={ticketRes.refetch}
      status={status}
      onStatusChange={applyStatus}
      onCreate={() => ticketModal.openModal("create")}
      modalOpen={ticketModal.open}
      onModalOpenChange={ticketModal.onOpenChange}
      form={
        <TicketCreateForm
          locations={extractLocationBuild}
          onSubmit={(d) => ticketRes.createTicket({ userId: userId ?? 0n, ...d })}
        />
      }
    >
      {ticketRes.list.map((t: TicketBuild) => (
        <TicketCard
          key={t.id.toString()}
          id={t.id}
          room={t.room}
          locationLabel={labelOf(extractLocationBuild, t.location)}
          type={t.type}
          status={t.status}
          comment={t.comment}
          createdAt={t.createdAt}
          onChangeStatus={ticketRes.changeStatus}
        />
      ))}
    </BoardShell>
  );
};
