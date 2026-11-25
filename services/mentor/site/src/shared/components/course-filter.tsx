"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { formatMentorCourseRange } from "@/shared/models/mentor-course";
import { MentorCourse } from "@fesmu/contract/mentor/entity/mentor.entity_pb";

const ALL_COURSES = "all";

interface CourseFilterProps {
  courses: MentorCourse[];
  value: bigint | undefined;
  onChange: (courseId: bigint | undefined) => void;
}

export function CourseFilter({ courses, value, onChange }: CourseFilterProps) {
  return (
    <Select
      value={value ? value.toString() : ALL_COURSES}
      onValueChange={(next) =>
        onChange(next === ALL_COURSES ? undefined : BigInt(next as string))
      }
    >
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue>
          {(selected: string) => {
            if (!selected || selected === ALL_COURSES) return "Все курсы";
            const course = courses.find((c) => c.id.toString() === selected);
            return course ? formatMentorCourseRange(course) : `#${selected}`;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_COURSES}>Все курсы</SelectItem>
        {courses.map((course) => (
          <SelectItem key={course.id.toString()} value={course.id.toString()}>
            {formatMentorCourseRange(course)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
