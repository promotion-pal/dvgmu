"use client";

import {
  MentorApplicationForm,
  useMentorApplicationForm,
} from "@/shared/models/mentor-application";
import { useMentorCourses } from "@/shared/models/mentor-course";
import { useEffect } from "react";

export function ApplicationFormSection() {
  const { courses, fetchCourses } = useMentorCourses();
  const { form, handleSubmit } = useMentorApplicationForm();

  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <section className="py-12 sm:py-24 bg-[#1a1a2e] text-white" id="form">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-[#c9a84c] text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.3em] font-sans font-light">
            Запись на курс
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif mt-3 mb-4">
            Цикл: Организация процедуры наставничества в здравоохранении.
          </h2>
          <p className="text-white/60 font-serif text-base sm:text-lg">
            Заполните форму, и наши методисты свяжутся с вами для оформления
            документов
          </p>
        </div>

        <MentorApplicationForm
          form={form}
          onSubmit={handleSubmit}
          courses={courses}
          submitting={form.formState.isSubmitting}
        />

        <div className="text-center text-white/30 text-xs font-sans mt-6">
          Вопросы по заявке:{" "}
          <a
            href="mailto:fpk@mail.fesmu.ru"
            className="text-[#c9a84c] hover:underline"
          >
            fpk@mail.fesmu.ru
          </a>
        </div>
      </div>
    </section>
  );
}
