import type { FC } from "react";
import { useRef, useState } from "react";
import type { Html5QrcodeScanner } from "html5-qrcode";
import { ScanLineIcon } from "lucide-react";

import { CommonModal } from "@/shared/components/modal";
import { Html5QrcodePlugin } from "@/shared/components/scanner";
import { Button } from "@/shared/ui/button";
import type { Analytic } from "@fesmu/contract/analytics/entity/analytic.entity_pb";

import { parseAnalyticScan, resolveScan } from "./analytic-qr-scan.lib";

/** Кнопка «Сканировать QR»: наводите камеру на табличку объекта — открывается
 * его правка (или карточка, если прав на изменение нет). */
export const AnalyticQrScanButton: FC<{ onFound: (item: Analytic) => void }> = ({ onFound }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const busyRef = useRef(false);

  const onScan = async (text: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    scannerRef.current?.pause(true);
    const target = parseAnalyticScan(text);
    const item = target ? await resolveScan(target).catch(() => undefined) : undefined;
    if (item) {
      setOpen(false);
      onFound(item);
      return;
    }
    setMessage(target ? "Объект с этим кодом не найден." : "Это не QR-код опроса.");
  };

  const again = () => {
    setMessage("");
    busyRef.current = false;
    scannerRef.current?.resume();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMessage("");
          busyRef.current = false;
          setOpen(true);
        }}
        title="Сканировать QR объекта"
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
      >
        <ScanLineIcon className="size-4" />
        <span className="hidden sm:inline">Сканировать</span>
      </button>
      <CommonModal
        open={open}
        onOpenChange={setOpen}
        title="Поиск объекта по QR-коду"
        description="Наведите камеру на QR-код таблички — объект сразу откроется для редактирования."
      >
        {open && (
          <div className="flex flex-col gap-4">
            <Html5QrcodePlugin scannerRef={scannerRef} fps={10} qrbox={250} disableFlip={false} qrCodeSuccessCallback={onScan} />
            {message && (
              <div className="flex flex-col items-start gap-2">
                <p className="text-sm text-destructive">{message}</p>
                <Button variant="outline" size="sm" onClick={again}>
                  Сканировать снова
                </Button>
              </div>
            )}
          </div>
        )}
      </CommonModal>
    </>
  );
};
