import type { FC } from "react";
import { useState } from "react";
import { QrCodeIcon } from "lucide-react";

import { CommonModal } from "@/shared/components/modal";
import { QrBatchExport } from "@/shared/components/qr-designer";
import type { Analytic } from "@dvgmu/contract/analytics/entity/analytic.entity_pb";

import { buildAnalyticQrUrl } from "./analytic.fn";
import { analyticCategoryEmoji } from "./analytic.utils";

/** Кнопка «QR на печать» — все переданные объекты разом на листы A4. */
export const AnalyticQrBatchButton: FC<{ list: Analytic[]; fileName?: string }> = ({ list, fileName }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={!list.length}
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
      >
        <QrCodeIcon className="size-4" />
        QR на печать ({list.length})
      </button>
      <CommonModal
        open={open}
        onOpenChange={setOpen}
        title="QR-коды на листы A4"
        description="Карточки ложатся на лист вплотную. Шаблон общий, у каждого кода можно поменять текст и шаблон, лишние — выключить."
        className="max-h-[94vh] overflow-y-auto sm:max-w-6xl"
      >
        {open && (
          <QrBatchExport
            fileName={fileName}
            items={list.map((item) => ({
              key: item.id.toString(),
              value: buildAnalyticQrUrl(item.qr),
              title: item.name,
              emoji: analyticCategoryEmoji(item.type),
            }))}
          />
        )}
      </CommonModal>
    </>
  );
};
