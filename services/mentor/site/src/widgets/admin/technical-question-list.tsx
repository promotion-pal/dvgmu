"use client";

import { DetailRow } from "@/shared/components/detail-row";
import { FilterableEntityList } from "@/shared/components/filterable-entity-list";
import { StatusBadge } from "@/shared/components/status-badge";
import { TableCell, TableHead } from "@/shared/ui/table";
import {
  MentorCourse,
  MentorTechnicalQuestion,
} from "@fesmu/contract/mentor/entity/mentor.entity_pb";
import { timestampDate } from "@bufbuild/protobuf/wkt";

interface TechnicalQuestionListProps {
  questions: MentorTechnicalQuestion[];
  loading: boolean;
  courses: MentorCourse[];
  courseLabelById: Map<string, string>;
  onMarkDone: (id: bigint, isDone: boolean) => void | Promise<void>;
}

const courseLabel = (
  item: MentorTechnicalQuestion,
  courseLabelById: Map<string, string>,
) => courseLabelById.get(item.courseId.toString()) ?? `#${item.courseId.toString()}`;

const formattedDate = (item: MentorTechnicalQuestion) =>
  item.createdAt ? timestampDate(item.createdAt).toLocaleString("ru-RU") : "—";

export function TechnicalQuestionList({
  questions,
  loading,
  courses,
  courseLabelById,
  onMarkDone,
}: TechnicalQuestionListProps) {
  return (
    <FilterableEntityList<MentorTechnicalQuestion>
      items={questions}
      loading={loading}
      getEmail={(item) => item.email}
      emptyLabel="Технических вопросов пока нет"
      getId={(item) => item.id.toString()}
      getCreatedAt={(item) => (item.createdAt ? timestampDate(item.createdAt) : undefined)}
      getIsDone={(item) => item.isDone}
      getSearchText={(item) =>
        `${item.lastName} ${item.firstName} ${item.patronymic} ${item.email} ${item.question}`
      }
      onMarkDone={(item, done) => onMarkDone(item.id, done)}
      detailTitle={(item) => `${item.lastName} ${item.firstName}`}
      getExportRow={(item) => ({
        ID: item.id.toString(),
        ФИО: `${item.lastName} ${item.firstName} ${item.patronymic}`,
        Email: item.email,
        Курс: courseLabel(item, courseLabelById),
        Вопрос: item.question,
        Дата: formattedDate(item),
        Статус: item.isDone ? "Обработана" : "В работе",
      })}
      exportFileName="Технические-вопросы"
      getCourseId={(item) => item.courseId}
      courses={courses}
      renderTableHead={() => (
        <>
          <TableHead>ID</TableHead>
          <TableHead>ФИО</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Курс</TableHead>
          <TableHead>Вопрос</TableHead>
          <TableHead>Дата</TableHead>
          <TableHead>Статус</TableHead>
        </>
      )}
      renderTableRow={(item) => (
        <>
          <TableCell>{item.id.toString()}</TableCell>
          <TableCell>
            {item.lastName} {item.firstName} {item.patronymic}
          </TableCell>
          <TableCell>{item.email}</TableCell>
          <TableCell>{courseLabel(item, courseLabelById)}</TableCell>
          <TableCell className="max-w-xs truncate whitespace-normal">
            {item.question}
          </TableCell>
          <TableCell>{formattedDate(item)}</TableCell>
          <TableCell>
            <StatusBadge isDone={item.isDone} />
          </TableCell>
        </>
      )}
      renderCard={(item) => (
        <>
          <div className="flex items-start justify-between gap-2 pr-6">
            <p className="text-sm font-medium text-[#1a1a2e]">
              {item.lastName} {item.firstName} {item.patronymic}
            </p>
            <span className="text-xs whitespace-nowrap text-muted-foreground">
              #{item.id.toString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{item.email}</p>
          <span className="inline-flex items-center rounded-full bg-[#c9a84c]/5 px-2 py-0.5 text-[10px] font-sans text-[#c9a84c]">
            {courseLabel(item, courseLabelById)}
          </span>
          <p className="text-sm leading-relaxed text-gray-700">{item.question}</p>
          <div className="flex items-center justify-between border-t border-gray-100 pt-1">
            <span className="text-xs text-muted-foreground">{formattedDate(item)}</span>
            <StatusBadge isDone={item.isDone} />
          </div>
        </>
      )}
      renderDetail={(item) => (
        <dl>
          <DetailRow
            label="ФИО"
            value={`${item.lastName} ${item.firstName} ${item.patronymic}`}
          />
          <DetailRow label="Email" value={item.email} />
          <DetailRow label="Курс" value={courseLabel(item, courseLabelById)} />
          <DetailRow label="Вопрос" value={item.question} />
          <DetailRow label="Дата" value={formattedDate(item)} />
          <DetailRow label="Статус" value={<StatusBadge isDone={item.isDone} />} />
        </dl>
      )}
    />
  );
}
