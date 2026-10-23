"use client";

import { CourseFilter } from "@/shared/components/course-filter";
import { MarkDoneAction } from "@/shared/components/mark-done-action";
import { EntityViewMode, ViewSwitcher } from "@/shared/components/view-switcher";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { MentorCourse } from "@proto/entity/mentor.entity_pb";
import { FileDown } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";
import * as XLSX from "xlsx";

interface FilterableEntityListProps<T> {
  items: T[];
  loading: boolean;
  emptyLabel: string;
  getId: (item: T) => string;
  getCreatedAt: (item: T) => Date | undefined;
  getIsDone: (item: T) => boolean;
  getSearchText: (item: T) => string;
  onMarkDone: (item: T, done: boolean) => void | Promise<void>;
  detailTitle: (item: T) => string;
  getEmail: (item: T) => string;
  getExportRow: (item: T) => Record<string, string | number>;
  exportFileName: string;
  renderTableHead: () => ReactNode;
  renderTableRow: (item: T) => ReactNode;
  renderCard: (item: T) => ReactNode;
  renderDetail: (item: T) => ReactNode;
  getCourseId?: (item: T) => bigint;
  courses?: MentorCourse[];
}

export function FilterableEntityList<T>({
  items,
  getEmail,
  loading,
  emptyLabel,
  getId,
  getCreatedAt,
  getIsDone,
  getSearchText,
  onMarkDone,
  detailTitle,
  getExportRow,
  exportFileName,
  renderTableHead,
  renderTableRow,
  renderCard,
  renderDetail,
  getCourseId,
  courses,
}: FilterableEntityListProps<T>) {
  const [search, setSearch] = useState("");
  const [courseId, setCourseId] = useState<bigint | undefined>(undefined);
  const [view, setView] = useState<EntityViewMode>("table");
  const [selected, setSelected] = useState<T | undefined>(undefined);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items
      .filter((item) => {
        if (query && !getSearchText(item).toLowerCase().includes(query)) {
          return false;
        }
        if (
          getCourseId &&
          courseId !== undefined &&
          getCourseId(item) !== courseId
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const doneA = getIsDone(a);
        const doneB = getIsDone(b);
        if (doneA !== doneB) return doneA ? 1 : -1;

        const dateA = getCreatedAt(a)?.getTime() ?? 0;
        const dateB = getCreatedAt(b)?.getTime() ?? 0;
        return dateB - dateA;
      });
  }, [items, search, courseId, getSearchText, getCourseId, getIsDone, getCreatedAt]);

  const handleExport = () => {
    const rows = visibleItems.map(getExportRow);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Данные");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `${exportFileName}-${date}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск..."
            className="sm:max-w-xs"
          />
          {getCourseId && courses && (
            <CourseFilter
              courses={courses}
              value={courseId}
              onChange={setCourseId}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={visibleItems.length === 0}
            onClick={handleExport}
          >
            <FileDown className="size-4" />
            Excel
          </Button>
          <ViewSwitcher value={view} onChange={setView} />
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Загрузка...</p>
      ) : visibleItems.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      ) : view === "table" ? (
        <Table>
          <TableHeader>
            <TableRow>
              {renderTableHead()}
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleItems.map((item) => (
              <TableRow
                key={getId(item)}
                className="cursor-pointer"
                onClick={() => setSelected(item)}
              >
                {renderTableRow(item)}
                <TableCell className="text-right">
                  <MarkDoneAction
                    email={getEmail(item)}
                    isDone={getIsDone(item)}
                    onToggle={(done) => onMarkDone(item, done)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((item) => (
            <div
              key={getId(item)}
              onClick={() => setSelected(item)}
              className="relative cursor-pointer space-y-2 rounded-md border border-gray-100 bg-white p-4 pr-10"
            >
              <div className="absolute top-2 right-2">
                <MarkDoneAction
                  email={getEmail(item)}
                  isDone={getIsDone(item)}
                  onToggle={(done) => onMarkDone(item, done)}
                />
              </div>
              {renderCard(item)}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(undefined)}
      >
        <DialogContent className="sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{detailTitle(selected)}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-3">
                {renderDetail(selected)}
                <div className="flex justify-end pt-2">
                  <MarkDoneAction
                    email={getEmail(selected)}
                    isDone={getIsDone(selected)}
                    onToggle={(done) => onMarkDone(selected, done)}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
