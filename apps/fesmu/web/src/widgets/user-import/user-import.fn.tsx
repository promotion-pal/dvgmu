import { useState } from "react";
import { useLocation } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { createClient } from "@connectrpc/connect";
import { toast } from "sonner";
import { connectTransport } from "@/shared/config/api";
import { ROUTE } from "@/shared/config/path";
import { useCommonModal } from "@/shared/components/modal";
import { UserImportService } from "@fesmu/contract/service/v1/user_import.service_pb";
import type { UserImportFromExcelResponse } from "@fesmu/contract/service/v1/user_import.service_pb";
import { userImportSchema } from "./user-import.schema";
import type { UserImportSchema } from "./user-import.schema";

const userImportClient = createClient(UserImportService, connectTransport);

export type ImportKind = "employee" | "student";

export const IMPORT_KIND_LABEL: Record<ImportKind, string> = {
    employee: "Сотрудники",
    student: "Студенты",
};

/** Which sheet the import button targets follows the page it's opened
 * from — the students page always imports students, every other page
 * (employees included) imports employees. */
const useImportKindForRoute = (): ImportKind => {
    const { pathname } = useLocation();
    return pathname === ROUTE.USER.STUDENTS ? "student" : "employee";
};

const fileToBytes = (file: File): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
        reader.readAsArrayBuffer(file);
    });

const useUserImport = () => {
    const modal = useCommonModal({ initialType: "create" });
    const [result, setResult] = useState<UserImportFromExcelResponse | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const kind = useImportKindForRoute();

    const form = useForm<UserImportSchema>({
        resolver: zodResolver(userImportSchema),
    });

    const handleSubmit = form.handleSubmit(async (values) => {
        setSubmitting(true);
        try {
            const content = await fileToBytes(values.file);
            const request = { fileName: values.file.name, content };
            const response =
                kind === "student"
                    ? await userImportClient.studentImportFromExcel(request)
                    : await userImportClient.employeeImportFromExcel(request);
            setResult(response);

            if (response.success) {
                toast.success(`Импорт завершён: создано ${response.createdCount}`);
            } else {
                toast.error(response.message || "Не удалось выполнить импорт");
            }
        } catch (error) {
            console.error("Ошибка при импорте:", error);
            toast.error(error instanceof Error ? error.message : "Произошла ошибка при импорте");
        } finally {
            setSubmitting(false);
        }
    });

    const openModal = () => {
        setResult(null);
        form.reset();
        modal.openModal("create");
    };

    return {
        form,
        handleSubmit,
        submitting,
        result,
        kind,
        modal: { ...modal, openModal },
    };
};

export { useUserImport };
