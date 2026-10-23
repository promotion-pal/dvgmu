"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ru } from "react-day-picker/locale";
import { FormProvider, useFormContext, useWatch } from "react-hook-form";

import {
  PromFieldInput,
  promAllowedPatternNaturalNumbers,
  promAllowedPatternPhone,
  promMaskFIO,
  promMaskPhone,
} from "@/features/lib/form";
import {
  bookingBlockReason,
  nextMonthRange,
  toISODate,
} from "@/shared/lib/duty-window";
import {
  GROUP_REGEX,
  RECORD_BOOK_REGEX,
  courseFromGroup,
  floorFromRoom,
} from "@/shared/lib/record-book";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Card } from "@/shared/ui/card";

import { useDutyRegistrationForm, useTakenDutyDates } from "./dormitory.fn";
import { DutyRegistrationSchema } from "./dormitory.schema";

type DutyRegistrationFormProps = ReturnType<typeof useDutyRegistrationForm>;

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none transition-[color,box-shadow] focus:border-ring focus:ring-3 focus:ring-ring/30";

const isStudentDataFilled = (v: Partial<DutyRegistrationSchema>): boolean =>
  !!v.lastName?.trim() &&
  !!v.firstName?.trim() &&
  /^\+7\d{10}$/.test(v.phone ?? "") &&
  RECORD_BOOK_REGEX.test(v.recordBook ?? "") &&
  GROUP_REGEX.test(v.group ?? "") &&
  /^\d{3,4}$/.test(v.room ?? "");

const DutyCalendarField = () => {
  const { control, setValue, formState } =
    useFormContext<DutyRegistrationSchema>();
  const values = useWatch({ control });
  const { group, room, data } = values;

  const { takenDatesForFloor, refetch } = useTakenDutyDates();

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const month = useMemo(() => nextMonthRange(), []);
  const ready = isStudentDataFilled(values);
  const course = courseFromGroup(group ?? "");
  const floor = floorFromRoom(room ?? "");
  const taken = useMemo(
    () => takenDatesForFloor(floor),
    [takenDatesForFloor, floor],
  );

  // при смене этажа/курса ранее выбранная дата может стать невалидной
  useEffect(() => {
    setValue("data", "", { shouldValidate: false });
  }, [floor, course, setValue]);

  const blockReason = ready ? bookingBlockReason(course) : null;

  const selected = data ? new Date(`${data}T00:00:00`) : undefined;
  const error = formState.errors.data?.message;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        Дата дежурства — {month.label}
      </span>

      {ready && course !== null && (
        <p className="text-xs text-muted-foreground">
          {course} курс
          {floor !== null && ` · этаж ${floor}`}
        </p>
      )}

      {!ready ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Сначала заполните данные студента выше — тогда откроется календарь.
        </p>
      ) : blockReason ? (
        <p className="text-sm text-destructive">{blockReason}</p>
      ) : (
        <Calendar
          mode="single"
          locale={ru}
          selected={selected}
          onSelect={(date) =>
            setValue("data", date ? toISODate(date) : "", {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
          month={month.start}
          startMonth={month.start}
          endMonth={month.start}
          disableNavigation
          disabled={[{ before: month.start }, { after: month.end }, ...taken]}
          modifiers={{ taken }}
          modifiersClassNames={{ taken: "line-through opacity-40" }}
          className="mx-auto rounded-md border [--cell-size:--spacing(9)] sm:[--cell-size:--spacing(10)]"
        />
      )}

      {ready && !blockReason && taken.length > 0 && (
        <span className="text-xs text-muted-foreground">
          Зачёркнутые числа уже заняты на этом этаже
        </span>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
};

const ConsentField = () => {
  const { register, formState } = useFormContext<DutyRegistrationSchema>();
  const error = formState.errors.consent?.message;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="consent"
        className="flex items-start gap-2 text-sm text-muted-foreground"
      >
        <input
          id="consent"
          type="checkbox"
          {...register("consent")}
          className="mt-0.5 size-4 shrink-0 accent-primary"
        />
        <span>
          Я даю согласие на обработку моих персональных данных. Они используются
          только для составления графика дежурств и никуда не передаются —{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="text-primary underline-offset-4 hover:underline"
          >
            политика обработки данных
          </Link>
          .
        </span>
      </label>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
};

const DutyRegistrationForm = ({
  form,
  handleSubmit,
  submitError,
}: DutyRegistrationFormProps) => {
  const FieldInput = PromFieldInput<DutyRegistrationSchema>;

  const values = useWatch({ control: form.control });
  const ready = isStudentDataFilled(values);
  const blockReason = ready
    ? bookingBlockReason(courseFromGroup(values.group ?? ""))
    : null;
  const canSubmit =
    ready && blockReason === null && !!values.data && values.consent === true;

  return (
    <FormProvider {...form}>
      <Card className="w-full p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldInput
            name="lastName"
            label="Фамилия"
            placeholder="Иванов"
            className={inputClass}
            mask={promMaskFIO}
            maxLength={64}
          />
          <FieldInput
            name="firstName"
            label="Имя"
            placeholder="Иван"
            className={inputClass}
            mask={promMaskFIO}
            maxLength={64}
          />
          <FieldInput
            name="patronymic"
            label="Отчество"
            placeholder="Иванович"
            className={inputClass}
            mask={promMaskFIO}
            maxLength={64}
          />
          <FieldInput
            name="phone"
            type="tel"
            inputMode="tel"
            label="Телефон"
            placeholder="+79000000000"
            className={inputClass}
            mask={promMaskPhone}
            allowedPattern={promAllowedPatternPhone}
            maxLength={12}
          />
          <FieldInput
            name="recordBook"
            inputMode="numeric"
            label="Номер зачётной книжки"
            placeholder="1024001"
            className={inputClass}
            allowedPattern={promAllowedPatternNaturalNumbers}
            maxLength={7}
            info={{
              title: "Формат номера",
              description:
                "7 цифр: первые 2 — код факультета. Факультет определяется автоматически.",
            }}
          />
          <FieldInput
            name="group"
            inputMode="numeric"
            label="Группа"
            placeholder="309"
            className={inputClass}
            allowedPattern={promAllowedPatternNaturalNumbers}
            maxLength={4}
            info={{
              title: "Номер группы",
              description:
                "Первая цифра номера группы — курс (309 → 3 курс). От курса зависит окно записи.",
            }}
          />
          <FieldInput
            name="room"
            inputMode="numeric"
            label="Комната"
            placeholder="305"
            className={inputClass}
            allowedPattern={promAllowedPatternNaturalNumbers}
            maxLength={4}
          />

          <DutyCalendarField />

          <ConsentField />

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={form.formState.isSubmitting || !canSubmit}
            className="mt-1 w-full"
          >
            Записаться на дежурство
          </Button>
        </form>
      </Card>
    </FormProvider>
  );
};

export { DutyRegistrationForm };
