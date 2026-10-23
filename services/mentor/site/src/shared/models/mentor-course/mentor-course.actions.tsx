"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { MentorCourse } from "@proto/entity/mentor.entity_pb";
import { PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { formatMentorCourseRange, useMentorCourseForm } from "./mentor-course.fn";
import { MentorCourseForm } from "./mentor-course.form";

interface MentorCourseRowActionsProps {
  course: MentorCourse;
  onUpdated: () => void;
  onDeleted: (id: bigint) => void;
}

export function MentorCourseRowActions({
  course,
  onUpdated,
  onDeleted,
}: MentorCourseRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false);
  const { form, handleSubmit, isEditing } = useMentorCourseForm(course, () => {
    setEditOpen(false);
    onUpdated();
  });

  return (
    <div className="flex items-center gap-1">
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Редактировать" />
          }
        >
          <PencilIcon />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактирование курса</DialogTitle>
          </DialogHeader>
          <MentorCourseForm
            form={form}
            onSubmit={handleSubmit}
            submitting={form.formState.isSubmitting}
            isEditing={isEditing}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Удалить"
              className="text-destructive hover:text-destructive"
            />
          }
        >
          <TrashIcon />
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить курс?</AlertDialogTitle>
            <AlertDialogDescription>
              Курс «{formatMentorCourseRange(course)}» будет удалён без
              возможности восстановления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => onDeleted(course.id)}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
