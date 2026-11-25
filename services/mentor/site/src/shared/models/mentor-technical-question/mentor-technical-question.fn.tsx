"use client";

import { useFetchState } from "@/features/lib/fetch";
import { mentorServiceClient } from "@/shared/api/mentor";
import { MentorTechnicalQuestion } from "@fesmu/contract/mentor/entity/mentor.entity_pb";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  mentorTechnicalQuestionSchema,
  MentorTechnicalQuestionSchema,
} from "./mentor-technical-question.schema";

export const useMentorTechnicalQuestionForm = (onSuccess?: () => void) => {
  const form = useForm<MentorTechnicalQuestionSchema>({
    resolver: zodResolver(mentorTechnicalQuestionSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      patronymic: "",
      email: "",
      courseId: "",
      question: "",
      consent: false,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await mentorServiceClient.mentorTechnicalQuestionCreate({
        firstName: values.firstName,
        lastName: values.lastName,
        patronymic: values.patronymic ?? "",
        email: values.email,
        courseId: BigInt(values.courseId),
        question: values.question,
      });

      if (response.success) {
        toast.success("Вопрос отправлен. Мы ответим в ближайшее время");
        form.reset();
        onSuccess?.();
      } else {
        toast.error(response.message || "Не удалось отправить вопрос");
      }
    } catch (error: any) {
      console.error("Ошибка отправки вопроса:", error);
      toast.error(error.message || "Не удалось отправить вопрос");
    }
  });

  return { form, handleSubmit };
};

export const useMentorTechnicalQuestions = () => {
  const listState = useFetchState<MentorTechnicalQuestion>();

  const fetchQuestions = async () => {
    listState.setLoading(true);
    listState.setError(false);

    try {
      const stream = mentorServiceClient.mentorTechnicalQuestionFetch({});
      const collected: MentorTechnicalQuestion[] = [];

      for await (const chunk of stream) {
        if (chunk.question) {
          collected.push(chunk.question);
        }
      }

      listState.setList(collected);
    } catch (error) {
      console.error(error);
      listState.setError(true);
    } finally {
      listState.setLoading(false);
    }
  };

  const markTechnicalQuestionDone = async (id: bigint, isDone: boolean) => {
    try {
      const response = await mentorServiceClient.mentorTechnicalQuestionMarkDone({
        id,
        isDone,
      });

      if (response.success) {
        await fetchQuestions();
      } else {
        toast.error(response.message || "Не удалось обновить статус вопроса");
      }
    } catch (error: any) {
      console.error("Ошибка обновления статуса вопроса:", error);
      toast.error(error.message || "Не удалось обновить статус вопроса");
    }
  };

  return {
    questions: listState.list,
    loading: listState.loading,
    error: listState.error,
    empty: listState.empty,
    fetchQuestions,
    markTechnicalQuestionDone,
  };
};
