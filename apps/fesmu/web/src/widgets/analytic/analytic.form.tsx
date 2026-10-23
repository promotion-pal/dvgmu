import type { FC } from "react";
import { FormProvider, useWatch } from "react-hook-form";

import {
  PromFieldInput,
  PromFieldSelect,
  promAllowedPatternNaturalNumbers,
} from "@/features/lib/form";
import { PromFieldTextArea } from "@/features/lib/form";
import { Button } from "@/shared/ui/button";

import type { useAnalyticForm } from "./analytic.fn";
import type { AnalyticSchema } from "./analytic.schema";
import { extractAnalyticCategory } from "./analytic.utils";

type AnalyticFormProps = ReturnType<typeof useAnalyticForm>;
const AnalyticForm: FC<AnalyticFormProps> = ({ form, handleSubmit, mode, originalQr, nextQr, takenBy, useNextQr }) => {
  type FormData = AnalyticSchema;

  const FieldInput = PromFieldInput<FormData>;
  const FieldSelect = PromFieldSelect<FormData>;
  const FieldTextarea = PromFieldTextArea<FormData>;

  const submitting = form.formState.isSubmitting;
  const qr = useWatch({ control: form.control, name: "qr" });
  const qrChanged = mode === "update" && originalQr !== undefined && Number(qr) > 0 && BigInt(Math.trunc(Number(qr))) !== originalQr;

  return (
    <section>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldInput
            name="name"
            label="Полное название — видит сотрудник в анкете"
            placeholder="Напр. «Лекционный зал №1, главный корпус, 2 этаж»"
          />

          <div className="flex flex-col gap-1.5">
            <FieldInput
              name="qr"
              label="Номер QR"
              placeholder={
                mode === "create" && nextQr ? `Пусто — будет ${nextQr.toString()}` : "Число из ссылки /analytic?qr=…"
              }
              allowedPattern={promAllowedPatternNaturalNumbers}
              info={{
                title: "Номер QR",
                description:
                  "Число из ссылки печатного QR (/analytic?qr=…). По нему сотрудник открывает опросник этого объекта. У каждого объекта номер свой.",
              }}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {takenBy ? (
                <span className="text-destructive">Номер занят: «{takenBy}»</span>
              ) : (
                Number(qr) > 0 && <span className="text-emerald-600">Номер свободен</span>
              )}
              {nextQr && (
                <button type="button" onClick={useNextQr} className="text-primary underline">
                  Взять свободный: {nextQr.toString()}
                </button>
              )}
            </div>
            {qrChanged && !takenBy && (
              <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Уже распечатанные коды с номером {originalQr?.toString()} перестанут открывать этот опрос — их нужно будет
                перепечатать.
              </p>
            )}
          </div>

          <FieldSelect
            name="type"
            label="Тип опроса"
            placeholder="Выберите тип"
            options={extractAnalyticCategory}
          />

          <FieldTextarea
            name="transcript"
            label="Короткое название — для отчётов аналитики"
            placeholder="Напр. «Зал 1 ГК» — пусто: в отчётах будет полное название"
            rows={1}
          />

          <Button type="submit" disabled={submitting || Boolean(takenBy)} className="self-start px-6">
            {submitting ? "Сохранение…" : mode === "update" ? "Сохранить" : "Создать объект"}
          </Button>
        </form>
      </FormProvider>
    </section>
  );
};

export { AnalyticForm };