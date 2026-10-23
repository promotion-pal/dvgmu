"use client";

import { useFetchState } from "@/features/lib/fetch";
import { mentorServiceClient } from "@/shared/api/mentor";
import { MentorCourse } from "@proto/entity/mentor.entity_pb";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { mentorCourseSchema, MentorCourseSchema } from "./mentor-course.schema";

export const formatMentorCourseRange = (course: MentorCourse) => {
  if (!course.startDate && !course.endDate) return `Курс #${course.id}`;

  const start = course.startDate
    ? timestampDate(course.startDate).toLocaleDateString("ru-RU")
    : "—";
  const end = course.endDate
    ? timestampDate(course.endDate).toLocaleDateString("ru-RU")
    : "—";

  return `${start} — ${end}`;
};

export const useMentorCourseForm = (
  course?: MentorCourse,
  onSuccess?: () => void,
) => {
  const isEditing = Boolean(course);

  const form = useForm<MentorCourseSchema>({
    resolver: zodResolver(mentorCourseSchema),
    defaultValues: {
      startDate: course?.startDate
        ? timestampDate(course.startDate).toISOString().slice(0, 10)
        : "",
      endDate: course?.endDate
        ? timestampDate(course.endDate).toISOString().slice(0, 10)
        : "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      const startDate = timestampFromDate(new Date(values.startDate));
      const endDate = timestampFromDate(new Date(values.endDate));

      const response =
        isEditing && course
          ? await mentorServiceClient.mentorCourseUpdate({
              id: course.id,
              startDate,
              endDate,
            })
          : await mentorServiceClient.mentorCourseCreate({
              startDate,
              endDate,
            });

      if (response.success) {
        toast.success(isEditing ? "Курс обновлён" : "Курс успешно создан");
        form.reset();
        onSuccess?.();
      } else {
        toast.error(response.message || "Не удалось сохранить курс");
      }
    } catch (error: any) {
      console.error("Ошибка сохранения курса:", error);
      toast.error(error.message || "Не удалось сохранить курс");
    }
  });

  return { form, handleSubmit, isEditing };
};

export const useMentorCourses = () => {
  const listState = useFetchState<MentorCourse>();

  const fetchCourses = async () => {
    listState.setLoading(true);
    listState.setError(false);

    try {
      const stream = mentorServiceClient.mentorCourseFetch({});
      const collected: MentorCourse[] = [];

      for await (const chunk of stream) {
        if (chunk.course) {
          collected.push(chunk.course);
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

  const deleteCourse = async (id: bigint) => {
    try {
      const response = await mentorServiceClient.mentorCourseDelete({ id });

      if (response.success) {
        toast.success("Курс удалён");
        await fetchCourses();
      } else {
        toast.error(response.message || "Не удалось удалить курс");
      }
    } catch (error: any) {
      console.error("Ошибка удаления курса:", error);
      toast.error(error.message || "Не удалось удалить курс");
    }
  };

  return {
    courses: listState.list,
    loading: listState.loading,
    error: listState.error,
    empty: listState.empty,
    fetchCourses,
    deleteCourse,
  };
};
