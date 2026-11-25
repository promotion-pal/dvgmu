"use client";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useId } from "react";
import { UseFormReturn } from "react-hook-form";
import { MentorCourseSchema } from "./mentor-course.schema";

interface MentorCourseFormProps {
  form: UseFormReturn<MentorCourseSchema>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
  isEditing?: boolean;
}

export function MentorCourseForm({
  form,
  onSubmit,
  submitting,
  isEditing,
}: MentorCourseFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  const idPrefix = useId();

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-startDate`}>Дата начала курса</Label>
        <Input
          id={`${idPrefix}-startDate`}
          type="date"
          {...register("startDate")}
        />
        {errors.startDate && (
          <p className="text-destructive text-xs">
            {errors.startDate.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-endDate`}>Дата окончания курса</Label>
        <Input
          id={`${idPrefix}-endDate`}
          type="date"
          {...register("endDate")}
        />
        {errors.endDate && (
          <p className="text-destructive text-xs">{errors.endDate.message}</p>
        )}
      </div>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting
          ? "Сохранение..."
          : isEditing
            ? "Сохранить изменения"
            : "Создать курс"}
      </Button>
    </form>
  );
}
