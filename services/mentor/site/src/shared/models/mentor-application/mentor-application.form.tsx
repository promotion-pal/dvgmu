"use client";

import { formatMentorCourseRange } from "@/shared/models/mentor-course";
import { MentorCourse } from "@proto/entity/mentor.entity_pb";
import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
import { MentorApplicationSchema } from "./mentor-application.schema";

const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-none px-4 sm:px-6 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a84c] transition font-serif text-sm sm:text-base";
const labelClass =
  "text-white/40 text-[10px] sm:text-xs uppercase tracking-widest font-sans block mb-1";
const errorClass = "text-[#e0a0a0] text-xs font-sans mt-1";

interface MentorApplicationFormProps {
  form: UseFormReturn<MentorApplicationSchema>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  courses: MentorCourse[];
  submitting?: boolean;
}

export function MentorApplicationForm({
  form,
  onSubmit,
  courses,
  submitting,
}: MentorApplicationFormProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 sm:mt-12 max-w-3xl mx-auto space-y-4 sm:space-y-6 text-left"
    >
      <div className="bg-white/5 p-4 sm:p-6 border border-white/10">
        <h3 className="text-[#c9a84c] font-serif text-base sm:text-lg mb-4">
          Информация о заявителе
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
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
          <div className="sm:col-span-2">
            <label className={labelClass}>Отчество</label>
            <input
              type="text"
              placeholder="Иванович"
              className={inputClass}
              {...register("patronymic")}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Электронная почта</label>
            <input
              type="email"
              placeholder="email@example.com"
              className={inputClass}
              {...register("email")}
            />
            {errors.email && (
              <p className={errorClass}>{errors.email.message}</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Даты обучения</label>
            <select className={inputClass} {...register("courseId")}>
              <option value="" className="bg-[#1a1a2e]">
                Выберите даты
              </option>
              {courses.map((course) => (
                <option
                  key={course.id.toString()}
                  value={course.id.toString()}
                  className="bg-[#1a1a2e]"
                >
                  {formatMentorCourseRange(course)}
                </option>
              ))}
            </select>
            {errors.courseId && (
              <p className={errorClass}>{errors.courseId.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 sm:gap-3">
        <input
          type="checkbox"
          className="mt-1 w-4 h-4 sm:w-5 sm:h-5 border-white/20 bg-white/5 checked:bg-[#c9a84c] rounded flex-shrink-0"
          {...register("consent")}
        />
        <label className="text-white/40 text-[10px] sm:text-sm font-sans">
          Я даю согласие на{" "}
          <Link
            href="/privacy"
            className="text-[#c9a84c] hover:text-[#d4b85c] transition hover:underline"
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
        className="w-full bg-[#c9a84c] text-[#1a1a2e] py-3 sm:py-4 rounded-full font-sans uppercase tracking-widest text-xs sm:text-sm hover:bg-[#d4b85c] transition disabled:opacity-50"
      >
        {submitting ? "Отправка..." : "Отправить заявку"}
      </button>
    </form>
  );
}
