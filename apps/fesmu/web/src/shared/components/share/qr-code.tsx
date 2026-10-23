import type { FC } from "react";
import { useRef } from "react";
import { DownloadIcon, QrCodeIcon } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { CommonModal, useCommonModal } from "../modal";
import { CommonShareLink } from "./share-link";
import { QrDesigner } from "../qr-designer";

interface CommonQrCodeProps {
  url: string;
  /** Name of the downloaded PNG, without the extension. */
  fileName?: string;
  /** Shown size in px; the image itself is drawn larger, so a download prints sharp. */
  size?: number;
  className?: string;
}

/** A link as a QR code to scan with a phone — drawn in the browser, the link
 * goes to no outside service — with a button to save it as a PNG. */
export const CommonQrCode: FC<CommonQrCodeProps> = ({ url, fileName = "qr-code", size = 200, className }) => {
  const wrapper = useRef<HTMLDivElement>(null);

  const download = () => {
    const canvas = wrapper.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `${fileName}.png`;
    link.click();
  };

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div ref={wrapper} className="rounded-lg bg-white p-2">
        <QRCodeCanvas value={url} size={size * 3} marginSize={2} level="M" style={{ width: size, height: size }} />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={download}>
        <DownloadIcon className="size-4" />
        Скачать PNG
      </Button>
    </div>
  );
};

interface CommonQrButtonProps {
  url: string;
  /** Heading of the window and the name under the code, e.g. the test's topic. */
  title?: string;
  /** The line over the code, e.g. "Отсканируйте и пройдите тест". */
  subtitle?: string;
  /** Put into the templates (and the code's centre in some), e.g. 📝. */
  emoji?: string;
  /** The template to start with, e.g. "classic" or "meme-paws". */
  defaultPreset?: string;
  fileName?: string;
  label?: string;
  className?: string;
}

/** "QR-код" button: opens the QR designer for the link — templates from plain
 * to memes, PNG and print — to hang up or show on the projector. */
export const CommonQrButton: FC<CommonQrButtonProps> = ({ url, title = "QR-код", subtitle, emoji, defaultPreset, fileName, label = "QR-код", className }) => {
  const modal = useCommonModal();

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => modal.openModal("view")} className={className}>
        <QrCodeIcon className="size-4" />
        {label}
      </Button>
      <CommonModal
        open={modal.open}
        onOpenChange={modal.onOpenChange}
        title={title}
        description="Выберите оформление — от строгого до мемного — и распечатайте или скачайте PNG."
        className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"
      >
        {modal.open && (
          <QrDesigner value={url} title={title} subtitle={subtitle} emoji={emoji} defaultPreset={defaultPreset} fileName={fileName} />
        )}
        <div className="flex justify-center">
          <CommonShareLink url={url} />
        </div>
      </CommonModal>
    </>
  );
};
