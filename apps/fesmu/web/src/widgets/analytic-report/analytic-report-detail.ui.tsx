/* eslint-disable react-hooks/set-state-in-effect -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import type { FC} from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { create } from "@bufbuild/protobuf";
import { ArrowLeftIcon, QrCodeIcon } from "lucide-react";

import { ROUTE } from "@/shared/config/path";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { CommonModal } from "@/shared/components/modal";
import { Button } from "@/shared/ui/button";
import { QrDesigner } from "@/shared/components/qr-designer";
import { analyticCategoryEmoji, analyticShortName, buildAnalyticQrUrl } from "@/widgets/analytic";

import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";

import { analyticClient, analyticTypeLabel } from "./analytic-report.fn";
import { AnalyticDetail } from "./analytic-report.ui";
import { AnalyticSchema } from "@fesmu/contract/analytics/entity/analytic.entity_pb";
import { resolveDate } from "@/widgets/analytic/analytic.lib";

export const AnalyticReportDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [entity, setEntity] = useState<Analytic | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const dateFrom = searchParams.get("from") ?? "";
  const dateTo = searchParams.get("to") ?? "";
  const withPeriod = (path: string) => {
    const query = searchParams.toString();
    return query ? `${path}?${query}` : path;
  };
  const filteredEntity = useMemo(() => {
    if (!entity || (!dateFrom && !dateTo)) return entity;
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY;
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;
    return create(AnalyticSchema, {
      ...entity,
      ratings: entity.ratings.filter((rating) => {
        const createdAt = resolveDate(rating.createdAt)?.getTime();
        return createdAt !== undefined && createdAt >= from && createdAt <= to;
      }),
    });
  }, [entity, dateFrom, dateTo]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    setLoading(true);
    setError(false);
    analyticClient
      .analyticByID({ id: BigInt(id) })
      .then((res) => {
        if (!cancelled) setEntity(res.entity);
      })
      .catch((err) => {
        console.error("Ошибка при получении данных аналитики:", err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <CommonWrapper
      title={entity ? analyticShortName(entity) : "Объект аналитики"}
      description={
        entity ? `${entity.name} · ${analyticTypeLabel(entity.type)} · QR ${entity.qr.toString()}` : undefined
      }
      action={
        <div className="flex flex-wrap gap-2">
          {entity && (
            <Button variant="outline" size="sm" onClick={() => setQrModalOpen(true)}>
              <QrCodeIcon className="size-3.5" />
              QR на печать
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate(
                entity
                  ? withPeriod(ROUTE.ANALYTICS.REPORT_CATEGORY.replace(":type", String(entity.type)))
                  : withPeriod(ROUTE.ANALYTICS.REPORT),
              )
            }
          >
            <ArrowLeftIcon className="size-3.5" />
            К категории
          </Button>
        </div>
      }
    >
      <CommonControlState
        isLoading={loading}
        isError={error}
        isEmpty={!loading && !error && !entity}
        error={<CommonServiceError service="аналитики" />}
      >
        {filteredEntity && (
          <AnalyticDetail entity={filteredEntity} dateRange={{ from: dateFrom, to: dateTo }} />
        )}
      </CommonControlState>

      {entity && (
        <CommonModal
          open={qrModalOpen}
          onOpenChange={setQrModalOpen}
          title="QR-код для печати"
          description={`Выберите оформление или загрузите свою обложку — по коду откроется анкета «${entity.name}».`}
          className="max-h-[90vh] overflow-y-auto sm:max-w-5xl"
        >
          <QrDesigner
            subtitle="Отсканируйте и оцените"
            key={entity.id.toString()}
            value={buildAnalyticQrUrl(entity.qr)}
            title={entity.name}
            emoji={analyticCategoryEmoji(entity.type)}
          />
        </CommonModal>
      )}
    </CommonWrapper>
  );
};
