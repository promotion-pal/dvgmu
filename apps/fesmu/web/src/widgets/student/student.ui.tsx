import type { ComponentProps, FC } from "react";
import { memberKey } from "@/shared/lib/role-members";
import { BookOpenIcon, CalendarIcon, GraduationCapIcon, HomeIcon, KeyIcon, MailIcon, PhoneIcon, UsersIcon } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import type { StudentWithUser } from "@fesmu/contract/service/user.service_pb";
import { PersonDetails, PersonSummary } from "@/shared/components/person";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonModal } from "@/shared/components/modal";
import { DEFAULT_USER_PASSWORD, formatUserFullName } from "@/widgets/user";
import { STUDENT_EDUCATION_FORM_LABEL, STUDENT_STATUS_LABEL } from "./student.fn";
import type { useStudent } from "./student.fn";
import { StudentForm } from "./student.form";

interface StudentCreateModalProps {
    formProps: ComponentProps<typeof StudentForm>;
}
const StudentCreateModal: FC<StudentCreateModalProps> = ({ formProps }) => {
    return <StudentForm {...formProps} />;
};

export { StudentCreateModal };

interface StudentListProps extends ComponentProps<typeof CommonControlState> {
    list: StudentWithUser[];
    studentModal: ReturnType<typeof useStudent>["studentModal"];
    activeMenu?: ReturnType<typeof useStudent>["activeMenu"];
}
const StudentList: FC<StudentListProps> = ({ list, studentModal, activeMenu, ...state }) => {
    return (
        <>
            <CommonControlState {...state}>
                <section className="grid md:grid-cols-3 gap-4">
                    {list.map((row) => (
                        <StudentListItem row={row} key={memberKey(row.student?.id, row.user)} activeMenu={activeMenu} />
                    ))}
                </section>
            </CommonControlState>

            <CommonModal
                {...studentModal}
                title={studentModal.modalConfig[studentModal.type].title}
                description={studentModal.modalConfig[studentModal.type].description}
            >
                {studentModal.modalConfig[studentModal.type].component}
            </CommonModal>
        </>
    );
};

interface StudentListItemProps {
    row: StudentWithUser;
    activeMenu?: ReturnType<typeof useStudent>["activeMenu"];
}
const StudentListItem: FC<StudentListItemProps> = ({ row, activeMenu }) => {
    if (!row.user) return null;

    return (
        <PersonSummary
            fullName={formatUserFullName(row.user)}
            email={row.user.email}
            phone={row.user.phone}
            badges={
                row.student && (
                    <Badge variant="secondary">{STUDENT_STATUS_LABEL[row.student.status]}</Badge>
                )
            }
            extra={
                row.student && (
                    <>
                        <span className="icon-inline gap-1">
                            <UsersIcon className="size-3" />
                            {row.student.group || "Без группы"}
                        </span>
                        {row.student.needsDormitory && (
                            <span className="icon-inline gap-1">
                                <HomeIcon className="size-3" />
                                Общежитие
                            </span>
                        )}
                    </>
                )
            }
            menuItems={activeMenu?.(row)}
        />
    );
};

export { StudentList };

interface StudentDetailsProps {
    item?: StudentWithUser;
}
const StudentDetails: FC<StudentDetailsProps> = ({ item }) => {
    if (!item?.user) return null;

    const { user, student } = item;

    return (
        <PersonDetails
            badges={student ? <Badge variant="secondary">{STUDENT_STATUS_LABEL[student.status]}</Badge> : <Badge variant="outline">Только роль</Badge>}
            rows={[
                { icon: <GraduationCapIcon className="size-4" />, label: "ФИО", value: formatUserFullName(user) },
                { icon: <MailIcon className="size-4" />, label: "Логин (email)", value: user.email || "—" },
                { icon: <PhoneIcon className="size-4" />, label: "Телефон", value: user.phone || "—" },
                { icon: <UsersIcon className="size-4" />, label: "Группа", value: student?.group || "—" },
                { icon: <BookOpenIcon className="size-4" />, label: "№ зачётки", value: student?.recordBook || "—" },
                {
                    icon: <GraduationCapIcon className="size-4" />,
                    label: "Форма обучения",
                    value: student ? (STUDENT_EDUCATION_FORM_LABEL[student.educationForm] ?? "—") : "—",
                },
                { icon: <HomeIcon className="size-4" />, label: "Общежитие", value: student?.needsDormitory ? "Требуется" : "Не требуется" },
                {
                    icon: <CalendarIcon className="size-4" />,
                    label: "Дата рождения",
                    value: user.birthday ? new Date(Number(user.birthday.seconds) * 1000).toLocaleDateString("ru-RU") : "—",
                },
                { icon: <KeyIcon className="size-4" />, label: "Пароль", value: DEFAULT_USER_PASSWORD },
            ]}
        />
    );
};

export { StudentDetails };
