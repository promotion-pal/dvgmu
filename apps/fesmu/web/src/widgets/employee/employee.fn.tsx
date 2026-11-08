import { useFetchState } from "@/features/lib/fetch";
import type { EmployeeWithUser } from "@fesmu/contract/mdm/service/user.service_pb";
import { EmployeeWithUserSchema, UserService } from "@fesmu/contract/mdm/service/user.service_pb";
import { UserEmployeeDepartment, UserEmployeePosition, UserEmployeeStatus, UserRole } from "@fesmu/contract/mdm/enum/user.enum_pb";
import { create } from "@bufbuild/protobuf";
import { withRoleMembers } from "@/shared/lib/role-members";
import { useCommonModal } from "@/shared/components/modal";
import type { CommonModalType } from "@/shared/components/modal";
import type { CommonPopoverProps } from "@/shared/components/menu";
import { connectTransport } from "@/shared/config/api";
import { exportWordTable } from "@/shared/lib/word-export";
import { DEFAULT_USER_PASSWORD, formatUserFullName } from "@/widgets/user";
import { createClient } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { EmployeeCreateModal, EmployeeDetails } from "./employee.ui";
import { DEPARTMENT_LABEL } from "@/shared/config/departments";
import { EMPLOYEE_POSITION_LABEL, EMPLOYEE_STATUS_LABEL } from "@/shared/config/employee-directory";
import { employeeSchema } from "./employee.schema";
import type { EmployeeSchema } from "./employee.schema";

const mdmClient = createClient(UserService, connectTransport);

const EMPLOYEE_DEPARTMENT_LABEL: Record<UserEmployeeDepartment, string> = { ...DEPARTMENT_LABEL };

const exportEmployeesToWord = async (list: EmployeeWithUser[]) => {
    if (list.length === 0) {
        toast.error("Нет сотрудников для экспорта");
        return;
    }

    try {
        await exportWordTable({
            title: "Сотрудники",
            fileName: "Сотрудники",
            columns: [
                { header: "ФИО", render: (row: EmployeeWithUser) => (row.user ? formatUserFullName(row.user) : "") },
                { header: "Отдел", render: (row: EmployeeWithUser) => EMPLOYEE_DEPARTMENT_LABEL[row.employee?.department ?? UserEmployeeDepartment.UNSPECIFIED] },
                { header: "Логин", render: (row: EmployeeWithUser) => row.user?.email || "" },
                { header: "Пароль", render: () => DEFAULT_USER_PASSWORD },
            ],
            rows: list,
        });
        toast.success(`Экспортировано сотрудников: ${list.length}`);
    } catch (error) {
        console.error("Ошибка при экспорте сотрудников в Word:", error);
        toast.error("Не удалось сформировать документ");
    }
};

interface UseEmployeeFormProps {
    refresh: () => Promise<void>;
    onCloseModal: () => void;
}
const useEmployeeForm = ({ refresh, onCloseModal }: UseEmployeeFormProps) => {
    const form = useForm({
        resolver: zodResolver(employeeSchema),
        defaultValues: {},
    });

    const handleSubmit = form.handleSubmit(async (values: EmployeeSchema) => {
        try {
            const response = await mdmClient.employeeCreate({
                userId: BigInt(values.userId),
                department: values.department ?? UserEmployeeDepartment.UNSPECIFIED,
            position: values.position ?? UserEmployeePosition.UNSPECIFIED,
            status: values.status ?? UserEmployeeStatus.USER_PRESENCE_STATUS_AVAILABLE,
            });

            if (response.success) {
                toast.success("Сотрудник добавлен");
                form.reset({});
                onCloseModal();
                await refresh();
            } else {
                toast.error(response.message || "Не удалось добавить сотрудника");
            }
        } catch (error) {
            console.error("Ошибка при добавлении сотрудника:", error);
            toast.error(error instanceof Error ? error.message : "Произошла ошибка при добавлении сотрудника");
        }
    });

    return { form, handleSubmit };
};

const useEmployee = () => {
    const listState = useFetchState<EmployeeWithUser>();
    const modal = useCommonModal<CommonModalType>({ initialType: "create" });

    const fetch = async () => {
        listState.setLoading(true);
        listState.setError(false);

        try {
            // Сотрудники — записи сотрудника и все с ролью «Сотрудник».
            const [employees, users] = await Promise.all([mdmClient.employeeFetch({}), mdmClient.userFetch({})]);
            listState.setList(
                withRoleMembers(employees.employees, users.users, UserRole.STAFF, (user) => create(EmployeeWithUserSchema, { user })),
            );
        } catch (error) {
            console.error("Ошибка при получении списка сотрудников:", error);
            listState.setError(true);
        } finally {
            listState.setLoading(false);
        }
    };

    const formProps = useEmployeeForm({ refresh: fetch, onCloseModal: modal.closeModal });

    const modalConfig: Record<
        CommonModalType,
        {
            title: string;
            description: string;
            component: ReactNode;
        }
    > = {
        view: {
            title: "Сотрудник",
            description: "Полная информация о сотруднике.",
            component: <EmployeeDetails item={listState.item} />,
        },
        create: {
            title: "Добавление сотрудника",
            description: "Выберите пользователя и укажите отдел.",
            component: <EmployeeCreateModal formProps={formProps} />,
        },
        update: {
            title: "Сотрудник",
            description: "",
            component: <></>,
        },
    };

    const activeMenu = (row: EmployeeWithUser): CommonPopoverProps["items"] => [
        {
            label: "Подробнее",
            icon: <InfoIcon className="h-3.5 w-3.5" />,
            onClick: () => {
                listState.setItem(row);
                modal.openModal("view");
            },
        },
    ];

    return {
        fetch,
        list: listState.list,
        error: listState.error,
        empty: listState.empty,
        loading: listState.loading,
        employeeModal: { ...modal, modalConfig },
        activeMenu,
    };
};

export { useEmployee, useEmployeeForm, EMPLOYEE_DEPARTMENT_LABEL, EMPLOYEE_POSITION_LABEL, EMPLOYEE_STATUS_LABEL, exportEmployeesToWord };
