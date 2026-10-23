import type { FC } from "react";
import { MessageSquareIcon } from "lucide-react";

import { resolveDate } from "@/widgets/analytic/analytic.lib";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import type { AnalyticRating } from "@fesmu/contract/entity/analytic.entity_pb";

import type { AnalyticFieldDef } from "./field-registry";
import { respondentName, respondentSubtitle, formatFieldValue } from "./analytic-report.stats";

const formatDay = (date?: Date): string =>
  date
    ? date.toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

const RatingValueRow: FC<{ rating: AnalyticRating; def: AnalyticFieldDef }> = ({
  rating,
  def,
}) => (
  <div className="flex items-center justify-between gap-3 border-b py-1.5 text-sm last:border-b-0">
    <span className="text-muted-foreground">{def.label}</span>
    <span className="font-medium">{formatFieldValue(rating, def)}</span>
  </div>
);

/**
 * Детали одного ответа (рейтинга): полный комментарий и значения всех полей
 * опроса именно для этого респондента. Общая для models_v2/analytic и
 * analytic-report, чтобы не дублировать разметку.
 */
export const RatingDetailModal: FC<{
  rating: AnalyticRating | undefined;
  metricFields: AnalyticFieldDef[];
  identityFields: AnalyticFieldDef[];
  onClose: () => void;
}> = ({ rating, metricFields, identityFields, onClose }) => (
  <Dialog open={!!rating} onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{rating ? respondentName(rating) : "Ответ"}</DialogTitle>
        <DialogDescription>
          {rating ? respondentSubtitle(rating) ?? "Детали ответа и комментарий" : ""}
        </DialogDescription>
      </DialogHeader>

      {rating && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageSquareIcon className="size-3.5" />
              Комментарий
            </p>
            <p className="text-sm">{rating.comment?.trim() || "Без комментария"}</p>
          </div>

          {identityFields.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Опрошенный
              </p>
              <div className="rounded-lg border p-3">
                {identityFields.map((def) => (
                  <RatingValueRow key={def.key} rating={rating} def={def} />
                ))}
              </div>
            </div>
          )}

          {metricFields.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Оценки
              </p>
              <div className="max-h-72 overflow-y-auto rounded-lg border p-3">
                {metricFields.map((def) => (
                  <RatingValueRow key={def.key} rating={rating} def={def} />
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {formatDay(resolveDate(rating.createdAt))}
          </p>
        </div>
      )}
    </DialogContent>
  </Dialog>
);
