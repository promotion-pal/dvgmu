"use client";

import { useMentorCourses } from "@/shared/models/mentor-course";
import {
  MentorTechnicalQuestionForm,
  useMentorTechnicalQuestionForm,
} from "@/shared/models/mentor-technical-question";
import { useEffect } from "react";

export function TechnicalQuestionFormSection() {
  const { courses, fetchCourses } = useMentorCourses();
  const { form, handleSubmit } = useMentorTechnicalQuestionForm();

  useEffect(() => {
    fetchCourses();
  }, []);

  return (
    <section className="py-12 sm:py-20 bg-[#1a1a2e] text-white" id="support">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-[#c9a84c] text-xs sm:text-sm uppercase tracking-[0.2em] sm:tracking-[0.3em] font-sans font-light">
            Техническая поддержка
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif mt-3 mb-4">
            Вопросы по прохождению цикла
          </h2>
          <p className="text-white/60 font-serif text-base sm:text-lg">
            Цикл: Организация процедуры наставничества в здравоохранении
          </p>
        </div>

        <div className="max-w-xl mx-auto mt-8 sm:mt-12">
          <MentorTechnicalQuestionForm
            form={form}
            onSubmit={handleSubmit}
            courses={courses}
            submitting={form.formState.isSubmitting}
          />
        </div>
      </div>
    </section>
  );
}
