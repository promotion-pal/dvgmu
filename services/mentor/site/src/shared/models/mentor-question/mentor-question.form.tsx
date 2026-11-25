"use client";

import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
import { MentorQuestionSchema } from "./mentor-question.schema";

const inputClass =
  "w-full border border-gray-200 rounded-none px-4 py-3 text-[#1a1a2e] placeholder-gray-400 focus:outline-none focus:border-[#c9a84c] transition font-serif text-sm";
const labelClass =
  "text-gray-400 text-[10px] uppercase tracking-widest font-sans block mb-1";
const errorClass = "text-red-500 text-xs font-sans mt-1";

interface MentorQuestionFormProps {
  form: UseFormReturn<MentorQuestionSchema>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitting?: boolean;
}

export function MentorQuestionForm({
  form,
  onSubmit,
  submitting,
}: MentorQuestionFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Фамилия</label>
          <input
            type="text"
            placeholder="Иванов"
            className={inputClass}
            {...register("lastName")}
          />
          {errors.lastName && (
            <p className={errorClass}>{errors.lastName.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Имя</label>
          <input
            type="text"
            placeholder="Иван"
            className={inputClass}
            {...register("firstName")}
          />
          {errors.firstName && (
            <p className={errorClass}>{errors.firstName.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Отчество</label>
        <input
          type="text"
          placeholder="Иванович"
          className={inputClass}
          {...register("patronymic")}
        />
      </div>

      <div>
        <label className={labelClass}>Email</label>
        <input
          type="text"
          placeholder="email@example.com"
          className={inputClass}
          {...register("email")}
        />
        {errors.email && <p className={errorClass}>{errors.email.message}</p>}
      </div>

      <div>
        <label className={labelClass}>Ваш вопрос</label>
        <textarea
          placeholder="Опишите ваш вопрос..."
          rows={4}
          className={`${inputClass} resize-none`}
          {...register("question")}
        />
        {errors.question && (
          <p className={errorClass}>{errors.question.message}</p>
        )}
      </div>

      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 border-gray-300 checked:bg-[#c9a84c] rounded flex-shrink-0"
          {...register("consent")}
        />
        <label className="text-gray-400 text-[10px] font-sans">
          Я даю согласие на{" "}
          <Link
            href="/privacy"
            className="text-[#c9a84c] hover:underline"
            target="_blank"
          >
            обработку персональных данных
          </Link>
        </label>
      </div>
      {errors.consent && <p className={errorClass}>{errors.consent.message}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-[#c9a84c] text-[#1a1a2e] py-3 rounded-full font-sans uppercase tracking-widest text-xs hover:bg-[#d4b85c] transition disabled:opacity-50"
      >
        {submitting ? "Отправка..." : "Отправить вопрос"}
      </button>
    </form>
  );
}
