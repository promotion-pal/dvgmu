"use client";

import { useFetchState } from "@/features/lib/fetch";
import { mentorServiceClient } from "@/shared/api/mentor";
import { MentorApplication } from "@proto/entity/mentor.entity_pb";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  mentorApplicationSchema,
  MentorApplicationSchema,
} from "./mentor-application.schema";

export const useMentorApplicationForm = (onSuccess?: () => void) => {
  const form = useForm<MentorApplicationSchema>({
    resolver: zodResolver(mentorApplicationSchema),
    defaultValues: {
      lastName: "",
      firstName: "",
      patronymic: "",
      email: "",
      courseId: "",
      consent: false,
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const response = await mentorServiceClient.mentorApplicationCreate({
        firstName: values.firstName,
        lastName: values.lastName,
        patronymic: values.patronymic ?? "",
        email: values.email,
        courseId: BigInt(values.courseId),
      });

      if (response.success) {
        toast.success(
          "Заявка отправлена. Мы свяжемся с вами в ближайшее время",
        );
        form.reset();
        onSuccess?.();
      } else {
        toast.error(response.message || "Не удалось отправить заявку");
      }
    } catch (error: any) {
      console.error("Ошибка отправки заявки:", error);
      toast.error(error.message || "Не удалось отправить заявку");
    }
  });

  return { form, handleSubmit };
};

export const useMentorApplications = () => {
  const listState = useFetchState<MentorApplication>();

  const fetchApplications = async () => {
    listState.setLoading(true);
    listState.setError(false);

    try {
      const stream = mentorServiceClient.mentorApplicationFetch({});
      const collected: MentorApplication[] = [];

      for await (const chunk of stream) {
        if (chunk.application) {
          collected.push(chunk.application);
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

  const markApplicationDone = async (id: bigint, isDone: boolean) => {
    try {
      const response = await mentorServiceClient.mentorApplicationMarkDone({
        id,
        isDone,
      });

      if (response.success) {
        await fetchApplications();
      } else {
        toast.error(response.message || "Не удалось обновить статус заявки");
      }
    } catch (error: any) {
      console.error("Ошибка обновления статуса заявки:", error);
      toast.error(error.message || "Не удалось обновить статус заявки");
    }
  };

  return {
    applications: listState.list,
    loading: listState.loading,
    error: listState.error,
    empty: listState.empty,
    fetchApplications,
    markApplicationDone,
  };
};
