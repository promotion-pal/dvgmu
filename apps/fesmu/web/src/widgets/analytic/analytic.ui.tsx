import type { FC } from "react";
import { PlusIcon } from "lucide-react";
import { QrDesigner } from "@/shared/components/qr-designer";
import { AnalyticQrBatchButton } from "./analytic-qr-batch";
import { AnalyticQrScanButton } from "./analytic-qr-scan";
import { Can, useCan } from "@/features/access";
import { PermissionSection } from "@/shared/config/permissions";

import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonControlState, CommonServiceError } from "@/shared/components/state";
import { CommonModal } from "@/shared/components/modal";
import { CommonPopover } from "@/shared/components/menu";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";

import type { AnalyticType } from "@dvgmu/analytics/enum/analytic.enum_pb";
import { useAnalytic, buildAnalyticQrUrl } from "./analytic.fn";
import { analyticCategoryEmoji, extractAnalyticCategory } from "./analytic.utils";

const typeLabel = (type: AnalyticType) =>
  extractAnalyticCategory.find((o) => o.value === type)?.label ?? "—";

export const AnalyticComponent: FC = () => {
  const canEdit = useCan(PermissionSection.ANALYTICS);
  const { analyticRes, analyticModal, qrModal, activeMenu, openScanned } = useAnalytic({ canEdit });

  return (
    <CommonWrapper
      title="Опросы"
      description="Объекты опросов с QR-кодами: по коду сотрудник открывает анкету. Сейчас — рабочее место, информационная безопасность, туалеты и лекционные залы."
      action={
        <div className="flex flex-wrap gap-2">
        <AnalyticQrScanButton onFound={openScanned} />
        <AnalyticQrBatchButton list={analyticRes.list} fileName="qr-опросы" />
        <Can section={PermissionSection.ANALYTICS}>
        <button
          type="button"
          onClick={() => analyticModal.openModal("create")}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <PlusIcon className="size-4" />
          Создать объект
        </button>
        </Can>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="Поиск по названию"
          value={analyticRes.searchQuery}
          onChange={(e) => analyticRes.setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={String(analyticRes.selectedType)}
          onChange={(e) =>
            analyticRes.setSelectedType(
              e.target.value === "all" ? "all" : (Number(e.target.value) as AnalyticType),
            )
          }
          className="rounded-lg border bg-background px-3 py-2 text-sm"
        >
          <option value="all">Все типы</option>
          {extractAnalyticCategory.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <CommonControlState
        isLoading={analyticRes.loading}
        isError={analyticRes.error}
        isEmpty={analyticRes.empty}
        error={<CommonServiceError service="аналитики" />}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {analyticRes.list.map((item) => (
            <div
              key={item.id.toString()}
              className="flex flex-col gap-2 rounded-xl border p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{item.name}</p>
                <CommonPopover items={activeMenu(item)} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{typeLabel(item.type)}</Badge>
                <span>QR: {item.qr.toString()}</span>
                <span>· оценок: {item.ratings.length}</span>
              </div>
              {item.transcript && (
                <p className="text-sm text-muted-foreground">В аналитике: {item.transcript}</p>
              )}
              <a
                href={buildAnalyticQrUrl(item.qr)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-primary underline break-all"
              >
                {buildAnalyticQrUrl(item.qr)}
              </a>
            </div>
          ))}
        </div>
      </CommonControlState>

      <CommonModal
        {...analyticModal}
        title={analyticModal.modalConfig[analyticModal.type].title}
        description={analyticModal.modalConfig[analyticModal.type].description}
      >
        {analyticModal.modalConfig[analyticModal.type].component}
      </CommonModal>

      <CommonModal
        open={qrModal.isOpen}
        onOpenChange={(open) => !open && qrModal.close()}
        title="QR-код объекта"
        description="Выберите оформление, распечатайте и разместите рядом с объектом — сотрудник сканирует и открывает опросник."
        className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
      >
        {qrModal.targetId != null && (() => {
          const target = analyticRes.list.find((i) => i.qr === qrModal.targetId);
          return (
            <QrDesigner
              subtitle="Отсканируйте и оцените"
              key={qrModal.targetId.toString()}
              value={buildAnalyticQrUrl(qrModal.targetId)}
              title={target?.name ?? "Опрос"}
              emoji={target ? analyticCategoryEmoji(target.type) : undefined}
            />
          );
        })()}
      </CommonModal>
    </CommonWrapper>
  );
};
