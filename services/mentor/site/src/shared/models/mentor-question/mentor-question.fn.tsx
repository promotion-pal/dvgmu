"use client";

import { useFetchState } from "@/features/lib/fetch";
import { mentorServiceClient } from "@/shared/api/mentor";
import { MentorQuestion } from "@proto/entity/mentor.entity_pb";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  mentorQuestionSchema,
  MentorQuestionSchema,
} from "./mentor-question.schema";

export const useMentorQuestionForm = (onSuccess?: () => void) => {
  const form = useForm<MentorQuestionSchema>({
    resolver: zodResolver(mentorQuestionSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      patronymic: "",
      email: "",
      question: "",
      consent: false,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await mentorServiceClient.mentorQuestionCreate({
        firstName: values.firstName,
        lastName: values.lastName,
        patronymic: values.patronymic ?? "",
        email: values.email,
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

export const useMentorQuestions = () => {
  const listState = useFetchState<MentorQuestion>();

  const fetchQuestions = async () => {
    listState.setLoading(true);
    listState.setError(false);

    try {
      const stream = mentorServiceClient.mentorQuestionFetch({});
      const collected: MentorQuestion[] = [];

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

  const markQuestionDone = async (id: bigint, isDone: boolean) => {
    try {
      const response = await mentorServiceClient.mentorQuestionMarkDone({
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
    markQuestionDone,
  };
};
