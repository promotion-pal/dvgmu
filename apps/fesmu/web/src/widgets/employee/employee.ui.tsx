import type { ComponentProps, FC } from "react";
import { BriefcaseIcon, KeyIcon, MailIcon, PhoneIcon } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import type { EmployeeWithUser } from "@fesmu/contract/mdm/service/user.service_pb";
import { UserEmployeeDepartment } from "@fesmu/contract/mdm/enum/user.enum_pb";
import { EMPLOYEE_POSITION_LABEL, EMPLOYEE_STATUS_LABEL } from "@/shared/config/employee-directory";
import { memberKey } from "@/shared/lib/role-members";
import { PersonDetails, PersonSummary } from "@/shared/components/person";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonModal } from "@/shared/components/modal";
import { DEFAULT_USER_PASSWORD, formatUserFullName } from "@/widgets/user";
import { EMPLOYEE_DEPARTMENT_LABEL } from "./employee.fn";
import type { useEmployee } from "./employee.fn";
import { EmployeeForm } from "./employee.form";

interface EmployeeCreateModalProps {
    formProps: ComponentProps<typeof EmployeeForm>;
}
const EmployeeCreateModal: FC<EmployeeCreateModalProps> = ({ formProps }) => {
    return <EmployeeForm {...formProps} />;
};

export { EmployeeCreateModal };

interface EmployeeListProps extends ComponentProps<typeof CommonControlState> {
    list: EmployeeWithUser[];
    employeeModal: ReturnType<typeof useEmployee>["employeeModal"];
    activeMenu?: ReturnType<typeof useEmployee>["activeMenu"];
}
const EmployeeList: FC<EmployeeListProps> = ({ list, employeeModal, activeMenu, ...state }) => {
    return (
        <>
            <CommonControlState {...state}>
                {Object.entries(
                    list.reduce<Record<string, EmployeeWithUser[]>>((groups, row) => {
                        const department = row.employee?.department ?? UserEmployeeDepartment.UNSPECIFIED;
                        (groups[String(department)] ??= []).push(row);
                        return groups;
                    }, {}),
                )
                    .sort((a, b) => EMPLOYEE_DEPARTMENT_LABEL[Number(a[0]) as UserEmployeeDepartment].localeCompare(EMPLOYEE_DEPARTMENT_LABEL[Number(b[0]) as UserEmployeeDepartment], "ru"))
                    .map(([department, rows]) => (
                        <section className="mb-8" key={department}>
                            <h2 className="mb-3 text-lg font-semibold">
                                {EMPLOYEE_DEPARTMENT_LABEL[Number(department) as UserEmployeeDepartment]} <span className="text-muted-foreground">({rows.length})</span>
                            </h2>
                            <div className="grid gap-4 md:grid-cols-3">
                                {rows.map((row) => (
                                    <EmployeeListItem row={row} key={memberKey(row.employee?.id, row.user)} activeMenu={activeMenu} />
                                ))}
                            </div>
                        </section>
                    ))}
            </CommonControlState>

            <CommonModal
                {...employeeModal}
                title={employeeModal.modalConfig[employeeModal.type].title}
                description={employeeModal.modalConfig[employeeModal.type].description}
            >
                {employeeModal.modalConfig[employeeModal.type].component}
            </CommonModal>
        </>
    );
};

interface EmployeeListItemProps {
    row: EmployeeWithUser;
    activeMenu?: ReturnType<typeof useEmployee>["activeMenu"];
}
const EmployeeListItem: FC<EmployeeListItemProps> = ({ row, activeMenu }) => {
    if (!row.user) return null;

    return (
        <PersonSummary
            fullName={formatUserFullName(row.user)}
            email={row.user.email}
            phone={row.user.phone}
            badges={<>
                <Badge variant="secondary">{EMPLOYEE_DEPARTMENT_LABEL[row.employee?.department ?? UserEmployeeDepartment.UNSPECIFIED]}</Badge>
                {row.employee && row.employee.position !== 0 && <Badge variant="outline">{EMPLOYEE_POSITION_LABEL[row.employee.position]}</Badge>}
                {row.employee && row.employee.status !== 0 && <Badge variant="outline">{EMPLOYEE_STATUS_LABEL[row.employee.status]}</Badge>}
            </>}
            menuItems={activeMenu?.(row)}
        />
    );
};

export { EmployeeList };

interface EmployeeDetailsProps {
    item?: EmployeeWithUser;
}
const EmployeeDetails: FC<EmployeeDetailsProps> = ({ item }) => {
    if (!item?.user) return null;

    const { user } = item;
    // Только роль, записи сотрудника нет — отдел не указан.
    const department = item.employee?.department ?? UserEmployeeDepartment.UNSPECIFIED;

    return (
        <PersonDetails
            badges={<Badge variant="secondary">{EMPLOYEE_DEPARTMENT_LABEL[department]}</Badge>}
            rows={[
                { icon: <BriefcaseIcon className="size-4" />, label: "ФИО", value: formatUserFullName(user) },
                { icon: <MailIcon className="size-4" />, label: "Логин (email)", value: user.email || "—" },
                { icon: <PhoneIcon className="size-4" />, label: "Телефон", value: user.phone || "—" },
                { icon: <BriefcaseIcon className="size-4" />, label: "Отдел", value: EMPLOYEE_DEPARTMENT_LABEL[department] },
                { icon: <BriefcaseIcon className="size-4" />, label: "Должность", value: item.employee?.position ? EMPLOYEE_POSITION_LABEL[item.employee.position] : "—" },
                { icon: <BriefcaseIcon className="size-4" />, label: "Статус", value: item.employee?.status ? EMPLOYEE_STATUS_LABEL[item.employee.status] : "—" },
                { icon: <KeyIcon className="size-4" />, label: "Пароль", value: DEFAULT_USER_PASSWORD },
            ]}
        />
    );
};

export { EmployeeDetails };
