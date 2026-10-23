import { useState } from "react";
import { createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import { CertificateService } from "@dvgmu/contract/fesmu/service/v1/certificate.service_pb";
import type { FileGenerateType } from "@dvgmu/contract/file/enum/file.enum_pb";
import { connectTransport } from "@/shared/config/api";

const certificateClient = createClient(CertificateService, connectTransport);

type CertificateOrderStep = "idle" | "loading" | "done";

const useCertificateOrder = () => {
  const [step, setStep] = useState<CertificateOrderStep>("idle");

  const order = async (userId: bigint, type: FileGenerateType, copies: number) => {
    setStep("loading");

    try {
      const response = await certificateClient.certificateOrder({
        userId,
        type,
        copies,
      });

      if (!response.success) {
        toast.error(response.message || "Не удалось сформировать справку");
        setStep("idle");
        return false;
      }

      downloadFile(response.fileName, response.content);
      toast.success("Справка сформирована и загружена");
      setStep("done");
      return true;
    } catch (error) {
      console.error("Ошибка при заказе справки:", error);
      toast.error(error instanceof Error ? error.message : "Произошла ошибка при заказе справки");
      setStep("idle");
      return false;
    }
  };

  const reset = () => setStep("idle");

  return { step, order, reset };
};

function downloadFile(fileName: string, content: Uint8Array) {
  const blob = new Blob([new Uint8Array(content)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName || "document.docx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export { downloadFile, useCertificateOrder };
