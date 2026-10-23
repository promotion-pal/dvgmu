"use client";

import {
  MentorQuestionForm,
  useMentorQuestionForm,
} from "@/shared/models/mentor-question";

export function QuestionFormSection() {
  const { form, handleSubmit } = useMentorQuestionForm();

  return (
    <div className="bg-white p-6 sm:p-8 border border-gray-200 sticky top-32">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#c9a84c] text-xl">✉</span>
        <h3 className="font-serif text-[#1a1a2e] text-lg">Задать вопрос</h3>
      </div>
      <p className="text-gray-500 font-sans text-sm mb-6">
        Не нашли ответ? Напишите нам, и мы ответим в ближайшее время
      </p>

      <MentorQuestionForm
        form={form}
        onSubmit={handleSubmit}
        submitting={form.formState.isSubmitting}
      />

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-center text-[10px] text-gray-400 font-sans">
          Или напишите нам на email:{" "}
          <a
            href="mailto:fpk@fesmu.ru"
            className="text-[#c9a84c] hover:underline"
          >
            fpk@fesmu.ru
          </a>
        </p>
      </div>
    </div>
  );
}
