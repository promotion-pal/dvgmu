"use client";

import { DetailRow } from "@/shared/components/detail-row";
import { FilterableEntityList } from "@/shared/components/filterable-entity-list";
import { StatusBadge } from "@/shared/components/status-badge";
import { TableCell, TableHead } from "@/shared/ui/table";
import { MentorApplication, MentorCourse } from "@fesmu/contract/mentor/entity/mentor.entity_pb";
import { timestampDate } from "@bufbuild/protobuf/wkt";

interface ApplicationListProps {
  applications: MentorApplication[];
  loading: boolean;
  courses: MentorCourse[];
  courseLabelById: Map<string, string>;
  onMarkDone: (id: bigint, isDone: boolean) => void | Promise<void>;
}

const courseLabel = (
  item: MentorApplication,
  courseLabelById: Map<string, string>,
) => courseLabelById.get(item.courseId.toString()) ?? `#${item.courseId.toString()}`;

const formattedDate = (item: MentorApplication) =>
  item.createdAt ? timestampDate(item.createdAt).toLocaleString("ru-RU") : "—";

export function ApplicationList({
  applications,
  loading,
  courses,
  courseLabelById,
  onMarkDone,
}: ApplicationListProps) {
  return (
    <FilterableEntityList<MentorApplication>
      items={applications}
      loading={loading}
      emptyLabel="Заявок пока нет"
      getEmail={(item) => item.email}
      getId={(item) => item.id.toString()}
      getCreatedAt={(item) => (item.createdAt ? timestampDate(item.createdAt) : undefined)}
      getIsDone={(item) => item.isDone}
      getSearchText={(item) =>
        `${item.lastName} ${item.firstName} ${item.patronymic} ${item.email}`
      }
      onMarkDone={(item, done) => onMarkDone(item.id, done)}
      detailTitle={(item) => `${item.lastName} ${item.firstName}`}
      getExportRow={(item) => ({
        ID: item.id.toString(),
        ФИО: `${item.lastName} ${item.firstName} ${item.patronymic}`,
        Email: item.email,
        Курс: courseLabel(item, courseLabelById),
        "Дата подачи": formattedDate(item),
        Статус: item.isDone ? "Обработана" : "В работе",
      })}
      exportFileName="Заявки"
      getCourseId={(item) => item.courseId}
      courses={courses}
      renderTableHead={() => (
        <>
          <TableHead>ID</TableHead>
          <TableHead>ФИО</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Курс</TableHead>
          <TableHead>Дата подачи</TableHead>
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
          <DetailRow label="Дата подачи" value={formattedDate(item)} />
          <DetailRow label="Статус" value={<StatusBadge isDone={item.isDone} />} />
        </dl>
      )}
    />
  );
}
