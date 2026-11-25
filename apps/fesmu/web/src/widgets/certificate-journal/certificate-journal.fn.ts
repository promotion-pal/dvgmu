import { useState } from "react";
import { ConnectError, createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import {
    CertificateOrderStatus,
    CertificateService,
} from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import type { CertificateOrderEntry } from "@fesmu/contract/fesmu/service/v1/certificate.service_pb";
import { FileGenerateType } from "@fesmu/contract/file/enum/file.enum_pb";
import type { User } from "@fesmu/contract/mdm/entity/user.entity_pb";
import { UserService } from "@fesmu/contract/mdm/service/user.service_pb";
import { useFetchState } from "@/features/lib/fetch";
import { CERTIFICATE_STATUS, downloadFile } from "@/features/certificate/certificate.fn";
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

const STATUS_LABEL = Object.fromEntries(
    Object.entries(CERTIFICATE_STATUS).map(([k, v]) => [k, v.label]),
) as Record<CertificateOrderStatus, string>;

const errorText = (error: unknown) => ConnectError.from(error).rawMessage;

const useCertificateJournal = () => {
    const orders = useFetchState<CertificateOrderEntry>();
    const [status, setStatus] = useState<CertificateOrderStatus>(CertificateOrderStatus.ORDERED);
    const [busy, setBusy] = useState<bigint | null>(null);
    // Чьи заказы видит сотрудник: факультеты его деканатов или все.
    const [scope, setScope] = useState<{ all: boolean; faculties: string[] }>({ all: true, faculties: [] });

    const fetch = async (next = status) => {
        orders.setLoading(true);
        orders.setError(false);
        try {
            const response = await certificateClient.certificateFetch({ status: next });
            orders.setList(response.orders);
            setScope({ all: response.allFaculties, faculties: response.faculties });
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

    const act = async (order: CertificateOrderEntry, run: () => Promise<void>, failure: string) => {
        setBusy(order.id);
        try {
            await run();
            await fetch();
        } catch (error) {
            toast.error(`${failure}: ${errorText(error)}`);
        } finally {
            setBusy(null);
        }
    };

    // Печать: документ скачивается, заказ — «готова к выдаче» (повторно — перепечатка).
    const print = (order: CertificateOrderEntry) =>
        act(order, async () => {
            const response = await certificateClient.certificatePrint({ id: order.id });
            downloadFile(response.fileName, response.content);
            if (order.status === CertificateOrderStatus.ORDERED) {
                toast.success(`Готова к выдаче: ${order.studentName}. Студент увидит это в кабинете.`);
            }
        }, "Не удалось сформировать справку");

    // Выдана: студент расписался и забрал.
    const issue = (order: CertificateOrderEntry) =>
        act(order, async () => {
            await certificateClient.certificateIssue({ id: order.id });
            toast.success(`Выдана: ${order.studentName}`);
        }, "Не удалось отметить выдачу");

    // Отклонить с причиной — её увидит студент.
    const cancel = (order: CertificateOrderEntry, reason: string) =>
        act(order, async () => {
            await certificateClient.certificateCancel({ id: order.id, reason });
            toast.success(`Заказ отклонён: ${order.studentName}`);
        }, "Не удалось отклонить заказ");

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

    return { orders, status, changeStatus, fetch, print, issue, cancel, busy, scope, orderFor };
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
