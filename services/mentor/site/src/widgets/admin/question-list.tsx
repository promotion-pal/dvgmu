"use client";

import { DetailRow } from "@/shared/components/detail-row";
import { FilterableEntityList } from "@/shared/components/filterable-entity-list";
import { StatusBadge } from "@/shared/components/status-badge";
import { TableCell, TableHead } from "@/shared/ui/table";
import { MentorQuestion } from "@proto/entity/mentor.entity_pb";
import { timestampDate } from "@bufbuild/protobuf/wkt";

interface QuestionListProps {
  questions: MentorQuestion[];
  loading: boolean;
  onMarkDone: (id: bigint, isDone: boolean) => void | Promise<void>;
}

const formattedDate = (item: MentorQuestion) =>
  item.createdAt ? timestampDate(item.createdAt).toLocaleString("ru-RU") : "—";

export function QuestionList({ questions, loading, onMarkDone }: QuestionListProps) {
  return (
    <FilterableEntityList<MentorQuestion>
      items={questions}
      loading={loading}
      emptyLabel="Вопросов пока нет"
      getEmail={(item) => item.email}
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
        Вопрос: item.question,
        Дата: formattedDate(item),
        Статус: item.isDone ? "Обработана" : "В работе",
      })}
      exportFileName="Вопросы"
      renderTableHead={() => (
        <>
          <TableHead>ID</TableHead>
          <TableHead>ФИО</TableHead>
          <TableHead>Email</TableHead>
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
          <DetailRow label="Вопрос" value={item.question} />
          <DetailRow label="Дата" value={formattedDate(item)} />
          <DetailRow label="Статус" value={<StatusBadge isDone={item.isDone} />} />
        </dl>
      )}
    />
  );
}
