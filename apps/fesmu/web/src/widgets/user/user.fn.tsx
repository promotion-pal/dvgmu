import { useFetchState } from "@/features/lib/fetch";
import type { User } from "@dvgmu/contract/packages/mdm/entity/user.entity_pb";
import { UserStatus } from "@dvgmu/contract/packages/mdm/enum/user.enum_pb";
import { UserService } from "@dvgmu/contract/packages/mdm/service/user.service_pb";
import { useCommonModal } from "@/shared/components/modal";
import type { CommonModalType } from "@/shared/components/modal";
import type { CommonPopoverProps } from "@/shared/components/menu";
import { connectTransport } from "@/shared/config/api";
import { exportWordTable } from "@/shared/lib/word-export";
import { createClient } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon, PencilIcon, TrashIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { UserCreateModal, UserDetails } from "./user.ui";
import { userSchema } from "./user.schema";
import type { UserSchema } from "./user.schema";

const userClient = createClient(UserService, connectTransport);

const USER_STATUS_LABEL: Record<UserStatus, string> = {
    [UserStatus.UNSPECIFIED]: "Не указано",
    [UserStatus.ACTIVE]: "Активен",
    [UserStatus.INACTIVE]: "Неактивен",
};

// MDM никогда не хранит пароль пользователя после его создания (он возвращается
// один раз в ответе на создание и нигде не сохраняется), поэтому для карточки
// "Подробнее" и экспорта используется единый пароль по умолчанию, который
// сотрудник обязан сменить при первом входе.
const DEFAULT_USER_PASSWORD = "fesmu12345!";

const formatUserFullName = (item: User) =>
    `${item.lastName} ${item.firstName} ${item.patronymic || ""}`.trim();

const exportUsersToWord = async (list: User[]) => {
    if (list.length === 0) {
        toast.error("Нет пользователей для экспорта");
        return;
    }

    try {
        await exportWordTable({
            title: "Пользователи",
            fileName: "Пользователи",
            columns: [
                { header: "ФИО", render: formatUserFullName },
                { header: "Логин", render: (item: User) => item.email || "" },
                { header: "Пароль", render: () => DEFAULT_USER_PASSWORD },
            ],
            rows: list,
        });
        toast.success(`Экспортировано пользователей: ${list.length}`);
    } catch (error) {
        console.error("Ошибка при экспорте пользователей в Word:", error);
        toast.error("Не удалось сформировать документ");
    }
};

const timestampToDateString = (timestamp?: { seconds: bigint }) => {
    if (!timestamp) return "";
    const date = new Date(Number(timestamp.seconds) * 1000);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
};

interface UseUserFormProps {
    item?: User;
    refresh: () => Promise<void>;
    onCloseModal: () => void;
}
const useUserForm = ({ item, refresh, onCloseModal }: UseUserFormProps) => {
    const isEditing = Boolean(item);

    const form = useForm({
        resolver: zodResolver(userSchema),
        defaultValues: {
            lastName: item?.lastName ?? "",
            firstName: item?.firstName ?? "",
            patronymic: item?.patronymic ?? "",
            email: item?.email ?? "",
            phone: item?.phone ?? "",
            birthday: timestampToDateString(item?.birthday),
        },
    });

    useEffect(() => {
        form.reset({
            lastName: item?.lastName ?? "",
            firstName: item?.firstName ?? "",
            patronymic: item?.patronymic ?? "",
            email: item?.email ?? "",
            phone: item?.phone ?? "",
            birthday: timestampToDateString(item?.birthday),
        });
    }, [item]);

    const parseToTimestamp = (dateString?: string) => {
        if (!dateString) return undefined;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return undefined;

        return {
            seconds: BigInt(Math.floor(date.getTime() / 1000)),
            nanos: 0,
        };
    };

    const handleSubmit = form.handleSubmit(async (values: UserSchema) => {
        try {
            const response =
                isEditing && item
                    ? await userClient.userUpdate({
                        id: item.id,
                        lastName: values.lastName,
                        firstName: values.firstName,
                        patronymic: values.patronymic || undefined,
                        email: values.email || undefined,
                        phone: values.phone || undefined,
                        birthday: parseToTimestamp(values.birthday),
                    })
                    : await userClient.userCreate({
                        lastName: values.lastName,
                        firstName: values.firstName,
                        patronymic: values.patronymic || undefined,
                        email: values.email,
                        phone: values.phone || undefined,
                        birthday: parseToTimestamp(values.birthday),
                    });

            if (response.success) {
                toast.success(isEditing ? "Пользователь обновлён" : "Пользователь добавлен");
                form.reset({});
                onCloseModal();
                await refresh();
            } else {
                toast.error(response.message || "Не удалось сохранить пользователя");
            }
        } catch (error) {
            console.error("Ошибка при сохранении пользователя:", error);
            toast.error(error instanceof Error ? error.message : "Произошла ошибка при сохранении пользователя");
        }
    });

    return { form, handleSubmit, isEditing };
};

const useUser = () => {
    const listState = useFetchState<User>();
    const singleState = useFetchState<User>();
    const [selectedIds, setSelectedIds] = useState<Set<bigint>>(new Set());

    const toggleSelected = (id: bigint) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearSelected = () => setSelectedIds(new Set());
    const selectAll = (ids: bigint[]) => setSelectedIds(new Set(ids));

    const modal = useCommonModal<CommonModalType>({
        initialType: "create",
        fnOpen: (id) => {
            singleState.setItem(listState.list.find((item) => item.id === id));
        },
    });

    const fetch = async () => {
        listState.setLoading(true);
        listState.setError(false);

        try {
            const response = await userClient.userFetch({});
            listState.setList(response.users);
        } catch (error) {
            console.error("Ошибка при получении списка пользователей:", error);
            listState.setError(true);
        } finally {
            listState.setLoading(false);
        }
    };

    const closeModal = () => {
        modal.closeModal();
        singleState.setItem(undefined);
    };

    const removeUsers = async (ids: bigint[]) => {
        if (ids.length === 0) return;

        const target = ids.length === 1 ? "этого пользователя" : `выбранных пользователей (${ids.length})`;
        if (!confirm(`Вы уверены, что хотите удалить ${target}? Вместе с ними удалятся паспорт, образование и записи студента/сотрудника.`)) return;

        try {
            const response = await userClient.userDeleteBatch({ ids });
            if (response.success) {
                toast.success(`Удалено: ${response.deletedCount}`);
                clearSelected();
                await fetch();
            } else {
                toast.error(response.message || "Не удалось удалить");
            }
        } catch (error) {
            console.error("Ошибка удаления:", error);
            toast.error("Не удалось удалить");
        }
    };

    const formProps = useUserForm({
        item: modal.type === "update" ? singleState.item : undefined,
        refresh: fetch,
        onCloseModal: closeModal,
    });

    const modalConfig: Record<
        CommonModalType,
        {
            title: string;
            description: string;
            component: ReactNode;
        }
    > = {
        view: {
            title: "Пользователь",
            description: "Полная информация о пользователе.",
            component: <UserDetails item={singleState.item} />,
        },
        create: {
            title: "Добавление пользователя",
            description: "Заполните форму, чтобы добавить пользователя.",
            component: <UserCreateModal formProps={formProps} />,
        },
        update: {
            title: "Редактирование пользователя",
            description: "Измените данные пользователя.",
            component: <UserCreateModal formProps={formProps} />,
        },
    };

    const activeMenu = (id: bigint): CommonPopoverProps["items"] => [
        {
            label: "Подробнее",
            icon: <InfoIcon className="h-3.5 w-3.5" />,
            onClick: () => modal.openModal("view", id),
        },
        {
            label: "Редактировать",
            icon: <PencilIcon className="h-3.5 w-3.5" />,
            onClick: () => modal.openModal("update", id),
        },
        {
            label: "Удалить",
            icon: <TrashIcon className="h-3.5 w-3.5" />,
            style: "text-destructive hover:text-destructive",
            onClick: () => removeUsers([id]),
        },
    ];

    return {
        fetch,
        list: listState.list,
        error: listState.error,
        empty: listState.empty,
        loading: listState.loading,
        userModal: {
            ...modal,
            closeModal,
            modalConfig,
        },
        activeMenu,
        selectedIds,
        toggleSelected,
        clearSelected,
        selectAll,
        removeSelected: () => removeUsers([...selectedIds]),
    };
};

export {
    useUser,
    useUserForm,
    USER_STATUS_LABEL,
    DEFAULT_USER_PASSWORD,
    formatUserFullName,
    exportUsersToWord,
};
