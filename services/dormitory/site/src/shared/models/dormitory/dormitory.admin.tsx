"use client";

import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { ru } from "react-day-picker/locale";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import {
  PromFieldInput,
  promAllowedPatternNaturalNumbers,
  promAllowedPatternPhone,
  promMaskFIO,
  promMaskPhone,
} from "@/features/lib/form";
import { CommonModal } from "@/shared/components/modal";
import { dormitoryAdminClient } from "@/shared/api/dormitory-admin";
import { userServiceClient } from "@/shared/api/user";
import { toISODate } from "@/shared/lib/duty-window";
import { floorFromRoom } from "@/shared/lib/record-book";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";

import type { DutyRow } from "./dormitory.fn";
import {
  adminRegistrationSchema,
  type AdminRegistrationSchema,
} from "./dormitory.schema";

export type AdminDateMode = "move" | "add";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30";

interface AdminDateDialogProps {
  row: DutyRow;
  mode: AdminDateMode;
  /** Занятые даты (ISO) на этаже строки — для disabled в календаре. */
  takenIso: string[];
  onClose: () => void;
  onDone: () => void;
}

const AdminDateDialog = ({
  row,
  mode,
  takenIso,
  onClose,
  onDone,
}: AdminDateDialogProps) => {
  const initial =
    mode === "move" && row.data ? timestampDate(row.data) : undefined;

  const [date, setDate] = useState<Date | undefined>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const disabled = useMemo(
    () => takenIso.map((iso) => new Date(`${iso}T00:00:00`)),
    [takenIso],
  );

  const defaultMonth = initial ?? new Date();

  const submit = async () => {
    if (!date) return;
    setBusy(true);
    setError(null);
    try {
      const data = timestampFromDate(new Date(`${toISODate(date)}T00:00:00Z`));
      if (mode === "move") {
        await dormitoryAdminClient.dormitoryRegistrationAdminUpsert({
          id: row.registrationId,
          data,
        });
      } else {
        await dormitoryAdminClient.dormitoryRegistrationAdminUpsert({
          userId: row.userId,
          room: row.room,
          data,
        });
      }
      onDone();
      onClose();
    } catch (e) {
      setError(
        e instanceof ConnectError ? e.rawMessage : "Не удалось сохранить",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <CommonModal
      open
      onOpenChange={(v) => !v && onClose()}
      title={
        mode === "move" ? "Перенести дежурство" : "Добавить день дежурства"
      }
      description={`${row.fullName} · этаж ${row.floor ?? "—"} · комната ${row.room}`}
    >
      <div className="flex flex-col items-center gap-4">
        <Calendar
          mode="single"
          locale={ru}
          selected={date}
          onSelect={(d) => setDate(d)}
          defaultMonth={defaultMonth}
          disabled={disabled}
          modifiers={{ taken: disabled }}
          modifiersClassNames={{ taken: "line-through opacity-40" }}
          className="rounded-md border [--cell-size:--spacing(9)]"
        />

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex w-full gap-2">
          <Button
            type="button"
            className="flex-1"
            disabled={busy || !date}
            onClick={submit}
          >
            {mode === "move" ? "Перенести" : "Добавить"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </CommonModal>
  );
};

interface AdminNewRegistrationDialogProps {
  /** Занятые даты (ISO) по этажам — для календаря. */
  takenByFloor: Map<number, Set<string>>;
  onClose: () => void;
  onDone: () => void;
}

const AdminNewRegistrationDialog = ({
  takenByFloor,
  onClose,
  onDone,
}: AdminNewRegistrationDialogProps) => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<AdminRegistrationSchema>({
    resolver: zodResolver(adminRegistrationSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      patronymic: "",
      phone: "+7",
      recordBook: "",
      group: "",
      room: "",
      data: "",
    },
  });

  const FieldInput = PromFieldInput<AdminRegistrationSchema>;
  const room = useWatch({ control: form.control, name: "room" });
  const data = useWatch({ control: form.control, name: "data" });

  const floor = floorFromRoom(room ?? "");
  const disabled = useMemo(() => {
    if (floor === null) return [];
    return [...(takenByFloor.get(floor) ?? [])].map(
      (iso) => new Date(`${iso}T00:00:00`),
    );
  }, [takenByFloor, floor]);

  const selected = data ? new Date(`${data}T00:00:00`) : undefined;

  const handleSubmit = form.handleSubmit(async (value) => {
    setSubmitError(null);
    try {
      const userRes = await userServiceClient.userCreate({
        phone: value.phone,
        lastName: value.lastName,
        firstName: value.firstName,
        patronymic: value.patronymic ?? "",
        recordBook: value.recordBook,
        group: value.group,
      });
      if (!userRes.success) {
        setSubmitError(userRes.message || "Не удалось сохранить студента");
        return;
      }
      await dormitoryAdminClient.dormitoryRegistrationAdminUpsert({
        userId: userRes.id,
        room: Number(value.room),
        data: timestampFromDate(new Date(`${value.data}T00:00:00Z`)),
      });
      onDone();
      onClose();
    } catch (e) {
      setSubmitError(
        e instanceof ConnectError ? e.rawMessage : "Не удалось записать",
      );
    }
  });

  return (
    <CommonModal
      open
      onOpenChange={(v) => !v && onClose()}
      title="Записать студента на дежурство"
      description="Создаёт студента и запись без студенческих ограничений"
    >
      <FormProvider {...form}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FieldInput name="lastName" label="Фамилия" placeholder="Иванов" className={inputClass} mask={promMaskFIO} maxLength={64} />
          <FieldInput name="firstName" label="Имя" placeholder="Иван" className={inputClass} mask={promMaskFIO} maxLength={64} />
          <FieldInput name="patronymic" label="Отчество" placeholder="Иванович" className={inputClass} mask={promMaskFIO} maxLength={64} />
          <FieldInput name="phone" type="tel" inputMode="tel" label="Телефон" placeholder="+79000000000" className={inputClass} mask={promMaskPhone} allowedPattern={promAllowedPatternPhone} maxLength={12} />
          <FieldInput name="recordBook" inputMode="numeric" label="Зачётка" placeholder="1024001" className={inputClass} allowedPattern={promAllowedPatternNaturalNumbers} maxLength={7} />
          <FieldInput name="group" inputMode="numeric" label="Группа" placeholder="309" className={inputClass} allowedPattern={promAllowedPatternNaturalNumbers} maxLength={4} />
          <FieldInput name="room" inputMode="numeric" label="Комната" placeholder="305" className={inputClass} allowedPattern={promAllowedPatternNaturalNumbers} maxLength={4} />

          <div className="flex flex-col items-center gap-1">
            <span className="self-start text-sm font-medium">
              Дата дежурства{floor !== null && ` · этаж ${floor}`}
            </span>
            <Calendar
              mode="single"
              locale={ru}
              selected={selected}
              onSelect={(d) =>
                form.setValue("data", d ? toISODate(d) : "", {
                  shouldValidate: true,
                })
              }
              disabled={disabled}
              modifiers={{ taken: disabled }}
              modifiersClassNames={{ taken: "line-through opacity-40" }}
              className="rounded-md border [--cell-size:--spacing(9)]"
            />
            {form.formState.errors.data && (
              <span className="self-start text-sm text-destructive">
                {form.formState.errors.data.message}
              </span>
            )}
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={form.formState.isSubmitting}
            >
              Записать
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Отмена
            </Button>
          </div>
        </form>
      </FormProvider>
    </CommonModal>
  );
};

export { AdminDateDialog, AdminNewRegistrationDialog };
