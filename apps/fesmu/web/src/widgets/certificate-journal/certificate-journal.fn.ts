import { useState } from "react";
import { ConnectError, createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import {
    CertificateOrderStatus,
    CertificateService,
} from "@dvgmu/contract/service/v1/certificate.service_pb";
import type { CertificateOrderEntry } from "@dvgmu/contract/service/v1/certificate.service_pb";
import { FileGenerateType } from "@dvgmu/contract/packages/files/enum/file.enum_pb";
import type { User } from "@dvgmu/contract/packages/mdm/entity/user.entity_pb";
import { UserService } from "@dvgmu/contract/packages/mdm/service/user.service_pb";
import { useFetchState } from "@/features/lib/fetch";
import { downloadFile } from "@/features/certificate/certificate.fn";
import { connectTransport } from "@/shared/config/api";

const certificateClient = createClient(CertificateService, connectTransport);
const mdmClient = createClient(UserService, connectTransport);

/** Справки, которые можно заказать и выдать. */
const CERTIFICATE_TYPES = [
    { type: FileGenerateType.WORD_GEN_APPLICATION_CERTIFICATE_ENROLLMENT, label: "О зачислении" },
    { type: FileGenerateType.WORD_GEN_STUDY_CERTIFICATE, label: "Об обучении" },
] as const;

const typeLabel = (type: FileGenerateType) =>
    CERTIFICATE_TYPES.find((t) => t.type === type)?.label ?? "Справка";

const STATUS_LABEL: Record<CertificateOrderStatus, string> = {
    [CertificateOrderStatus.UNSPECIFIED]: "—",
    [CertificateOrderStatus.ORDERED]: "Заказана",
    [CertificateOrderStatus.ISSUED]: "Выдана",
};

const errorText = (error: unknown) => ConnectError.from(error).rawMessage;

const useCertificateJournal = () => {
    const orders = useFetchState<CertificateOrderEntry>();
    const [status, setStatus] = useState<CertificateOrderStatus>(CertificateOrderStatus.ORDERED);
    const [busy, setBusy] = useState<bigint | null>(null);

    const fetch = async (next = status) => {
        orders.setLoading(true);
        orders.setError(false);
        try {
            const response = await certificateClient.certificateFetch({ status: next });
            orders.setList(response.orders);
        } catch (error) {
            console.error("Ошибка при загрузке журнала справок:", error);
            orders.setError(true);
        } finally {
            orders.setLoading(false);
        }
    };

    const changeStatus = (next: CertificateOrderStatus) => {
        setStatus(next);
        void fetch(next);
    };

    // Выдать: отметить и скачать документ для печати (повторно — перепечатка).
    const issue = async (order: CertificateOrderEntry) => {
        setBusy(order.id);
        try {
            const response = await certificateClient.certificateIssue({ id: order.id });
            downloadFile(response.fileName, response.content);
            toast.success(`Справка выдана: ${order.studentName}`);
            await fetch();
        } catch (error) {
            toast.error(`Не удалось выдать справку: ${errorText(error)}`);
        } finally {
            setBusy(null);
        }
    };

    // Сформировать за студента: сразу записывается выданной.
    const orderFor = async (student: User, type: FileGenerateType, copies: number) => {
        try {
            const response = await certificateClient.certificateOrder({ userId: student.id, type, copies });
            if (!response.success) {
                toast.error(response.message || "Не удалось сформировать справку");
                return false;
            }
            downloadFile(response.fileName, response.content);
            toast.success("Справка сформирована и выдана");
            await fetch();
            return true;
        } catch (error) {
            toast.error(`Не удалось сформировать справку: ${errorText(error)}`);
            return false;
        }
    };

    return { orders, status, changeStatus, fetch, issue, busy, orderFor };
};

/** Список пользователей MDM для выбора студента. */
const useStudentPicker = () => {
    const users = useFetchState<User>();
    const load = async () => {
        if (users.list.length > 0) return;
        users.setLoading(true);
        try {
            const response = await mdmClient.userFetch({});
            users.setList(response.users);
        } catch (error) {
            toast.error(`Не удалось загрузить пользователей: ${errorText(error)}`);
        } finally {
            users.setLoading(false);
        }
    };
    return { users, load };
};

export { CERTIFICATE_TYPES, STATUS_LABEL, typeLabel, useCertificateJournal, useStudentPicker };
