"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { PromFieldInput, PromFieldTextArea } from "@/features/lib/form/text/prom.form.text";
import {
  courseQuestionSchema,
  CourseQuestionSchema,
} from "@/shared/models/course-question/course-question.schema";

const fieldClassName =
  "rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary";

export function QuestionForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const form = useForm<CourseQuestionSchema>({
    resolver: zodResolver(courseQuestionSchema),
    defaultValues: { name: "", email: "", question: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    setSubmittedEmail(values.email);
    form.reset();
  });

  if (submittedEmail) {
    return (
      <div className="rounded-3xl border border-border bg-background p-7 text-center sm:p-8">
        <p className="text-lg font-bold text-foreground">Вопрос отправлен</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Мы ответим на {submittedEmail} в течение 1–2 рабочих дней.
        </p>
        <button
          type="button"
          onClick={() => setSubmittedEmail(null)}
          className="mt-5 text-sm font-semibold text-primary hover:underline"
        >
          Задать ещё один вопрос
        </button>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        className="rounded-3xl border border-border bg-background p-7 sm:p-8"
      >
        <div className="flex flex-col gap-4">
          <PromFieldInput
            name="name"
            label="Имя"
            placeholder="Как к вам обращаться"
            className={fieldClassName}
          />
          <PromFieldInput
            name="email"
            type="email"
            label="Почта"
            placeholder="you@example.com"
            className={fieldClassName}
          />
          <PromFieldTextArea
            name="question"
            label="Ваш вопрос"
            placeholder="Например: как проходит отбор и сколько времени в неделю занимает стажировка?"
            rows={4}
            className={fieldClassName}
          />
        </div>

        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground transition hover:brightness-95 disabled:opacity-60"
        >
          {form.formState.isSubmitting ? "Отправляем…" : "Отправить вопрос"}
        </button>
      </form>
    </FormProvider>
  );
}
