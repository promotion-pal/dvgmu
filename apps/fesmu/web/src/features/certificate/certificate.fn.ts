import { useState } from "react";
import { ConnectError, createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import { CertificateOrderStatus, CertificateService } from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import type { CertificateOrderEntry } from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import type { FileGenerateType } from "@fesmu/contract/file/enum/file.enum_pb";
import { connectTransport } from "@/shared/config/api";
import { useFetchState } from "@/features/lib/fetch";

const certificateClient = createClient(CertificateService, connectTransport);

/** Статусы справки — общие для кабинета студента и журнала деканата. */
const CERTIFICATE_STATUS: Record<CertificateOrderStatus, { label: string; hint: string; tone: "default" | "secondary" | "outline" | "destructive" }> = {
  [CertificateOrderStatus.UNSPECIFIED]: { label: "—", hint: "", tone: "outline" },
  [CertificateOrderStatus.ORDERED]: {
    label: "Заказана",
    hint: "Заказ принят. Деканат готовит справку.",
    tone: "outline",
  },
  [CertificateOrderStatus.READY]: {
    label: "Готова к выдаче",
    hint: "Справка готова. Заберите её в деканате и распишитесь в получении.",
    tone: "default",
  },
  [CertificateOrderStatus.ISSUED]: { label: "Выдана", hint: "Справка выдана.", tone: "secondary" },
  [CertificateOrderStatus.CANCELLED]: { label: "Отклонена", hint: "Деканат отклонил заказ.", tone: "destructive" },
};

type CertificateOrderStep = "idle" | "loading" | "done";

/** Заказ справки студентом на себя: файла нет — справку печатает деканат. */
const useCertificateOrder = (onOrdered?: () => void) => {
  const [step, setStep] = useState<CertificateOrderStep>("idle");

  const order = async (type: FileGenerateType, copies: number) => {
    setStep("loading");
    try {
      const response = await certificateClient.certificateOrder({ type, copies });
      if (!response.success) {
        toast.error(response.message || "Не удалось оформить заказ");
        setStep("idle");
        return false;
      }
      toast.success(response.message || "Заказ принят");
      setStep("done");
      onOrdered?.();
      return true;
    } catch (error) {
      console.error("Ошибка при заказе справки:", error);
      toast.error(ConnectError.from(error).rawMessage || "Произошла ошибка при заказе справки");
      setStep("idle");
      return false;
    }
  };

  const reset = () => setStep("idle");

  return { step, order, reset };
};

/** Свои заказы студента — статусы в кабинете. */
const useMyCertificates = () => {
  const orders = useFetchState<CertificateOrderEntry>();

  const fetch = async () => {
    orders.setLoading(true);
    orders.setError(false);
    try {
      const response = await certificateClient.certificateMyFetch({});
      orders.setList(response.orders);
    } catch (error) {
      console.error("Ошибка при загрузке заказов справок:", error);
      orders.setError(true);
    } finally {
      orders.setLoading(false);
    }
  };

  return { orders, fetch };
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

export { CERTIFICATE_STATUS, certificateClient, downloadFile, useCertificateOrder, useMyCertificates };
