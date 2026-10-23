import { useFetchState } from "@/features/lib/fetch";
import type { StudentWithUser } from "@fesmu/contract/service/user.service_pb";
import { StudentWithUserSchema } from "@fesmu/contract/service/user.service_pb";
import { UserRole } from "@fesmu/contract/enum/user.enum_pb";
import { create } from "@bufbuild/protobuf";
import { withRoleMembers } from "@/shared/lib/role-members";
import { UserService } from "@fesmu/contract/service/user.service_pb";
import { UserStudentEducationForm, UserStudentStatus } from "@fesmu/contract/enum/user.enum_pb";
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
import { StudentCreateModal, StudentDetails } from "./student.ui";
import { studentSchema } from "./student.schema";
import type { StudentSchema } from "./student.schema";

const mdmClient = createClient(UserService, connectTransport);

const STUDENT_STATUS_LABEL: Record<UserStudentStatus, string> = {
    [UserStudentStatus.UNSPECIFIED]: "Не указано",
    [UserStudentStatus.STUDYING]: "Учится",
    [UserStudentStatus.EXPELLED]: "Отчислен",
    [UserStudentStatus.ACADEMIC_LEAVE]: "В академическом отпуске",
    [UserStudentStatus.RESTORED]: "Восстановлен",
    [UserStudentStatus.GRADUATED]: "Выпустился",
    [UserStudentStatus.TRANSFERRED]: "Переведён",
};

const STUDENT_EDUCATION_FORM_LABEL: Record<UserStudentEducationForm, string> = {
    [UserStudentEducationForm.UNSPECIFIED]: "Не указано",
    [UserStudentEducationForm.BUDGET]: "Бюджет",
    [UserStudentEducationForm.TARGET]: "Целевое",
    [UserStudentEducationForm.CONTRACT]: "Контракт",
    [UserStudentEducationForm.SPECIAL_QUOTA]: "Особая квота",
};

const exportStudentsToWord = async (list: StudentWithUser[]) => {
    if (list.length === 0) {
        toast.error("Нет студентов для экспорта");
        return;
    }

    try {
        await exportWordTable({
            title: "Студенты",
            fileName: "Студенты",
            columns: [
                { header: "ФИО", render: (row: StudentWithUser) => (row.user ? formatUserFullName(row.user) : "") },
                { header: "Группа", render: (row: StudentWithUser) => row.student?.group || "" },
                { header: "Логин", render: (row: StudentWithUser) => row.user?.email || "" },
                { header: "Пароль", render: () => DEFAULT_USER_PASSWORD },
            ],
            rows: list,
        });
        toast.success(`Экспортировано студентов: ${list.length}`);
    } catch (error) {
        console.error("Ошибка при экспорте студентов в Word:", error);
        toast.error("Не удалось сформировать документ");
    }
};

interface UseStudentFormProps {
    refresh: () => Promise<void>;
    onCloseModal: () => void;
}
const useStudentForm = ({ refresh, onCloseModal }: UseStudentFormProps) => {
    const form = useForm({
        resolver: zodResolver(studentSchema),
        defaultValues: {},
    });

    const handleSubmit = form.handleSubmit(async (values: StudentSchema) => {
        try {
            const response = await mdmClient.studentCreate({
                userId: BigInt(values.userId),
                group: values.group,
                recordBook: values.recordBook || "",
                status: values.status ?? UserStudentStatus.UNSPECIFIED,
                educationForm: values.educationForm ?? UserStudentEducationForm.UNSPECIFIED,
                needsDormitory: values.needsDormitory ?? false,
            });

            if (response.success) {
                toast.success("Студент добавлен");
                form.reset({});
                onCloseModal();
                await refresh();
            } else {
                toast.error(response.message || "Не удалось добавить студента");
            }
        } catch (error) {
            console.error("Ошибка при добавлении студента:", error);
            toast.error(error instanceof Error ? error.message : "Произошла ошибка при добавлении студента");
        }
    });

    return { form, handleSubmit };
};

const useStudent = () => {
    const listState = useFetchState<StudentWithUser>();
    const modal = useCommonModal<CommonModalType>({ initialType: "create" });

    const fetch = async () => {
        listState.setLoading(true);
        listState.setError(false);

        try {
            // Студенты — записи студента и все с ролью «Студент».
            const [students, users] = await Promise.all([mdmClient.studentFetch({}), mdmClient.userFetch({})]);
            listState.setList(
                withRoleMembers(students.students, users.users, UserRole.STUDENT, (user) => create(StudentWithUserSchema, { user })),
            );
        } catch (error) {
            console.error("Ошибка при получении списка студентов:", error);
            listState.setError(true);
        } finally {
            listState.setLoading(false);
        }
    };

    const formProps = useStudentForm({ refresh: fetch, onCloseModal: modal.closeModal });

    const modalConfig: Record<
        CommonModalType,
        {
            title: string;
            description: string;
            component: ReactNode;
        }
    > = {
        view: {
            title: "Студент",
            description: "Полная информация о студенте.",
            component: <StudentDetails item={listState.item} />,
        },
        create: {
            title: "Добавление студента",
            description: "Выберите пользователя и заполните данные студента.",
            component: <StudentCreateModal formProps={formProps} />,
        },
        update: {
            title: "Студент",
            description: "",
            component: <></>,
        },
    };

    const activeMenu = (row: StudentWithUser): CommonPopoverProps["items"] => [
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
        studentModal: { ...modal, modalConfig },
        activeMenu,
    };
};

export {
    useStudent,
    useStudentForm,
    STUDENT_STATUS_LABEL,
    STUDENT_EDUCATION_FORM_LABEL,
    exportStudentsToWord,
};
