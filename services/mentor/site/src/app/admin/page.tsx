"use client";

import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { clearAdminAuthenticated, useRequireAdminAuth } from "@/shared/lib/admin-auth";
import { useMentorApplications } from "@/shared/models/mentor-application";
import {
  formatMentorCourseRange,
  MentorCourseForm,
  MentorCourseRowActions,
  useMentorCourseForm,
  useMentorCourses,
} from "@/shared/models/mentor-course";
import { useMentorQuestions } from "@/shared/models/mentor-question";
import { useMentorTechnicalQuestions } from "@/shared/models/mentor-technical-question";
import {
  ApplicationList,
  QuestionList,
  TechnicalQuestionList,
} from "@/widgets/admin";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function AdminPage() {
  const ready = useRequireAdminAuth();
  const router = useRouter();

  const {
    courses,
    fetchCourses,
    deleteCourse,
    loading: coursesLoading,
  } = useMentorCourses();
  const { form: courseForm, handleSubmit: handleCourseSubmit } =
    useMentorCourseForm(undefined, fetchCourses);

  const {
    applications,
    fetchApplications,
    markApplicationDone,
    loading: applicationsLoading,
  } = useMentorApplications();

  const {
    questions,
    fetchQuestions,
    markQuestionDone,
    loading: questionsLoading,
  } = useMentorQuestions();

  const {
    questions: technicalQuestions,
    fetchQuestions: fetchTechnicalQuestions,
    markTechnicalQuestionDone,
    loading: technicalQuestionsLoading,
  } = useMentorTechnicalQuestions();

  useEffect(() => {
    if (!ready) return;
    fetchCourses();
    fetchApplications();
    fetchQuestions();
    fetchTechnicalQuestions();
  }, [ready]);

  const courseLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of courses) {
      map.set(course.id.toString(), formatMentorCourseRange(course));
    }
    return map;
  }, [courses]);

  const handleLogout = () => {
    clearAdminAuthenticated();
    router.replace("/admin/login");
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 font-sans text-sm">
        Проверка доступа...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6f0] py-10 px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl text-[#1a1a2e]">Админ-панель</h1>
          <Button variant="outline" onClick={handleLogout}>
            Выйти
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Новый курс</CardTitle>
            </CardHeader>
            <CardContent>
              <MentorCourseForm
                form={courseForm}
                onSubmit={handleCourseSubmit}
                submitting={courseForm.formState.isSubmitting}
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Курсы</CardTitle>
            </CardHeader>
            <CardContent>
              {coursesLoading ? (
                <p className="text-muted-foreground text-sm">Загрузка...</p>
              ) : courses.length === 0 ? (
                <p className="text-muted-foreground text-sm">Курсов пока нет</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Дата начала</TableHead>
                      <TableHead>Дата окончания</TableHead>
                      <TableHead className="text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
              
                  <TableBody>
                    {courses.map((course) => (
                      <TableRow key={course.id.toString()}>
                        <TableCell>{course.id.toString()}</TableCell>
                        <TableCell>
                          {course.startDate
                            ? timestampDate(course.startDate).toLocaleDateString("ru-RU")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {course.endDate
                            ? timestampDate(course.endDate).toLocaleDateString("ru-RU")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <MentorCourseRowActions
                            course={course}
                            onUpdated={fetchCourses}
                            onDeleted={deleteCourse}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Заявки</CardTitle>
          </CardHeader>

          <CardContent>
            <ApplicationList
              applications={applications}
              loading={applicationsLoading}
              courses={courses}
              courseLabelById={courseLabelById}
              onMarkDone={markApplicationDone}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Вопросы</CardTitle>
          </CardHeader>

          <CardContent>
            <QuestionList
              questions={questions}
              loading={questionsLoading}
              onMarkDone={markQuestionDone}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Технические вопросы</CardTitle>
          </CardHeader>

          <CardContent>
            <TechnicalQuestionList
              questions={technicalQuestions}
              loading={technicalQuestionsLoading}
              courses={courses}
              courseLabelById={courseLabelById}
              onMarkDone={markTechnicalQuestionDone}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
