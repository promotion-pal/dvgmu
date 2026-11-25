/* eslint-disable react-hooks/set-state-in-effect -- перенесено из старого dvgmu (shared/models_v2) как есть, в проде работает */
import type { FC} from "react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

import { ROUTE } from "@/shared/config/path";
import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { QrDesigner } from "@/shared/components/qr-designer";
import { analyticCategoryEmoji, analyticShortName, buildAnalyticQrUrl } from "@/widgets/analytic";

import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";

import { analyticClient, analyticTypeLabel } from "./analytic-report.fn";
import { AnalyticDetail } from "./analytic-report.ui";

export const AnalyticReportDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [entity, setEntity] = useState<Analytic | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            navigate(
              entity
                ? ROUTE.ANALYTICS.REPORT_CATEGORY.replace(":type", String(entity.type))
                : ROUTE.ANALYTICS.REPORT,
            )
          }
        >
          <ArrowLeftIcon className="size-3.5" />
          К категории
        </Button>
      }
    >
      <CommonControlState
        isLoading={loading}
        isError={error}
        isEmpty={!loading && !error && !entity}
        error={<CommonServiceError service="аналитики" />}
      >
        {entity && (
          <AnalyticDetail entity={entity} />
        )}
      </CommonControlState>

      {entity && (
        <Card className="mt-6 p-6">
          <p className="mb-1 font-heading text-sm font-semibold">QR-код для печати</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Выберите оформление или загрузите свою обложку — по коду откроется анкета «{entity.name}».
          </p>
          <QrDesigner
            subtitle="Отсканируйте и оцените"
            key={entity.id.toString()}
            value={buildAnalyticQrUrl(entity.qr)}
            title={entity.name}
            emoji={analyticCategoryEmoji(entity.type)}
          />
        </Card>
      )}

    </CommonWrapper>
  );
};
