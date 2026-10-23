"use client";

import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { ConnectError } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { dormitoryServiceClient } from "@/shared/api/dormitory";
import { userServiceClient } from "@/shared/api/user";
import {
  bookingBlockReason,
  nextMonthRange,
  toISODateUTC,
} from "@/shared/lib/duty-window";
import {
  courseFromGroup,
  facultyFromRecordBook,
  floorFromRoom,
} from "@/shared/lib/record-book";
import { DormitoryRegistration } from "@proto/entity/dormitory.entity_pb";

import { DutyRegistrationSchema, dutyRegistrationSchema } from "./dormitory.schema";

const collectRegistrations = async () => {
  const collected: DormitoryRegistration[] = [];
  for await (const chunk of dormitoryServiceClient.dormitoryRegistrationFetch({})) {
    if (chunk.entity) collected.push(chunk.entity);
  }
  return collected;
};

/**
 * Запись на дежурство создаётся двумя вызовами: сначала UserCreate (студент),
 * затем DormitoryRegistrationCreate с полученным userId.
 */
const useDutyRegistrationForm = (onSuccess?: () => void) => {
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<DutyRegistrationSchema>({
    resolver: zodResolver(dutyRegistrationSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      patronymic: "",
      phone: "+7",
      recordBook: "",
      group: "",
      room: "",
      data: "",
      consent: false,
    },
  });

  const handleSubmit = form.handleSubmit(async (value) => {
    setSubmitError(null);

    const course = courseFromGroup(value.group);
    const blocked = bookingBlockReason(course);
    if (blocked) {
      setSubmitError(blocked);
      return;
    }

    const month = nextMonthRange();
    const [pickedYear, pickedMonth] = value.data.split("-").map(Number);
    if (
      pickedYear !== month.start.getFullYear() ||
      pickedMonth !== month.start.getMonth() + 1
    ) {
      setSubmitError(`Дежурство назначается на ${month.label}`);
      return;
    }
    const picked = new Date(`${value.data}T00:00:00Z`);

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

      const regRes = await dormitoryServiceClient.dormitoryRegistrationCreate({
        userId: userRes.id,
        room: Number(value.room),
        recordBook: value.recordBook,
        data: timestampFromDate(picked),
      });
      if (!regRes.success) {
        setSubmitError(regRes.message || "Не удалось создать запись");
        return;
      }

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error("Ошибка записи на дежурство:", error);
      setSubmitError(
        error instanceof ConnectError
          ? error.rawMessage
          : "Не удалось связаться с сервером",
      );
    }
  });

  return { form, handleSubmit, submitError };
};

/** Занятые даты дежурства по этажам (для календаря в форме). */
const useTakenDutyDates = () => {
  const [takenByFloor, setTakenByFloor] = useState<Map<number, Set<string>>>(
    new Map(),
  );

  const refetch = useCallback(async () => {
    try {
      const registrations = await collectRegistrations();
      const map = new Map<number, Set<string>>();
      for (const registration of registrations) {
        const floor = floorFromRoom(registration.room);
        if (floor === null || !registration.data) continue;
        const iso = toISODateUTC(timestampDate(registration.data));
        if (!map.has(floor)) map.set(floor, new Set());
        map.get(floor)!.add(iso);
      }
      setTakenByFloor(map);
    } catch (error) {
      console.error("Не удалось загрузить занятые даты:", error);
    }
  }, []);

  const takenDatesForFloor = useCallback(
    (floor: number | null): Date[] => {
      if (floor === null) return [];
      const set = takenByFloor.get(floor);
      if (!set) return [];
      return [...set].map((iso) => new Date(`${iso}T00:00:00`));
    },
    [takenByFloor],
  );

  return { takenDatesForFloor, refetch };
};

export interface DutyRow {
  registrationId: bigint;
  userId: bigint;
  fullName: string;
  phone: string;
  recordBook: string;
  group: string;
  faculty: string;
  course: number | null;
  room: number;
  floor: number | null;
  data?: Timestamp;
}

const useDutyRegistrations = () => {
  const [rows, setRows] = useState<DutyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [usersRes, registrations] = await Promise.all([
        userServiceClient.userFetch({}),
        collectRegistrations(),
      ]);

      const usersById = new Map(
        usersRes.users.map((user) => [user.id.toString(), user]),
      );

      setRows(
        registrations.map((registration) => {
          const user = usersById.get(registration.userId.toString());
          const recordBook = user?.recordBook || registration.recordBook;

          return {
            registrationId: registration.id,
            userId: registration.userId,
            fullName: user
              ? [user.lastName, user.firstName, user.patronymic]
                  .filter(Boolean)
                  .join(" ")
              : `Студент #${registration.userId}`,
            phone: user?.phone ?? "",
            recordBook,
            group: user?.group ?? "",
            faculty: facultyFromRecordBook(recordBook),
            course: courseFromGroup(user?.group ?? ""),
            room: registration.room,
            floor: floorFromRoom(registration.room),
            data: registration.data,
          };
        }),
      );
    } catch (err) {
      console.error("Ошибка загрузки записей:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const empty = useMemo(() => rows.length === 0, [rows]);

  return { rows, loading, error, empty, fetch };
};

export { useDutyRegistrationForm, useDutyRegistrations, useTakenDutyDates };
