import { useFetchState } from "@/features/lib/fetch";
import type { Infrastructure } from "@dvgmu/fesmu/entity/v1/infrastructure.entity_pb";
import { LocationCommonType } from "@dvgmu/fesmu/enum/v1/location.enum_pb";
import { InfrastructureService } from "@dvgmu/fesmu/service/v1/infrastructure.service_pb";
import { useCommonModal } from "@/shared/components/modal";
import type { CommonModalType } from "@/shared/components/modal";
import type { CommonPopoverProps } from "@/shared/components/menu";
import { connectTransport } from "@/shared/config/api";
import { createClient } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { PencilIcon, TrashIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { InfrastructureForm } from "./infrastructure.form";
import { infrastructureSchema } from "./infrastructure.schema";
import type { InfrastructureSchema } from "./infrastructure.schema";

const infrastructureClient = createClient(InfrastructureService, connectTransport);

const LOCATION_COMMON_TYPE_LABEL: Record<LocationCommonType, string> = {
    [LocationCommonType.UNSPECIFIED]: "Не указано",
    [LocationCommonType.OFFICE]: "Кабинет",
    [LocationCommonType.CLASSROOM]: "Учебная аудитория",
    [LocationCommonType.LABORATORY]: "Лаборатория",
    [LocationCommonType.WAREHOUSE]: "Склад",
    [LocationCommonType.COMMON_AREA]: "Общая зона",
};

interface UseInfrastructureFormProps {
    item?: Infrastructure;
    refresh: () => Promise<void>;
    onCloseModal: () => void;
}
const useInfrastructureForm = ({ item, refresh, onCloseModal }: UseInfrastructureFormProps) => {
    const isEditing = Boolean(item);

    const form = useForm({
        resolver: zodResolver(infrastructureSchema),
        defaultValues: {
            title: item?.title ?? "",
            description: item?.description ?? "",
            floor: item?.floor ?? 1,
            room: item?.room ?? 1,
            location: item?.location,
        },
    });

    useEffect(() => {
        form.reset({
            title: item?.title ?? "",
            description: item?.description ?? "",
            floor: item?.floor ?? 1,
            room: item?.room ?? 1,
            location: item?.location,
        });
    }, [item]);

    const handleSubmit = form.handleSubmit(async (values: InfrastructureSchema) => {
        try {
            const response =
                isEditing && item
                    ? await infrastructureClient.infrastructureUpdate({
                        id: item.id,
                        title: values.title,
                        description: values.description ?? "",
                        floor: values.floor,
                        room: values.room,
                    })
                    : await infrastructureClient.infrastructureCreate({
                        title: values.title,
                        description: values.description ?? "",
                        floor: values.floor,
                        room: values.room,
                        location: values.location ?? LocationCommonType.UNSPECIFIED,
                    });

            if (response.success) {
                toast.success(isEditing ? "Помещение обновлено" : "Помещение добавлено");
                form.reset();
                onCloseModal();
                await refresh();
            } else {
                toast.error(response.message || "Не удалось сохранить помещение");
            }
        } catch (error: any) {
            console.error("Ошибка при сохранении помещения:", error);
            toast.error(error.message || "Не удалось сохранить помещение");
        }
    });

    return { form, handleSubmit, isEditing };
};

const useInfrastructure = () => {
    const listState = useFetchState<Infrastructure>();
    const singleState = useFetchState<Infrastructure>();

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
            const response = await infrastructureClient.infrastructureFetch({});
            listState.setList(response.list);
        } catch (error) {
            console.error("Ошибка при получении списка помещений:", error);
            listState.setError(true);
        } finally {
            listState.setLoading(false);
        }
    };

    const closeModal = () => {
        modal.closeModal();
        singleState.setItem(undefined);
    };

    const formProps = useInfrastructureForm({
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
            title: "Помещение",
            description: "Информация о помещении.",
            component: <></>,
        },
        create: {
            title: "Новое помещение",
            description: "Заполните форму ниже, чтобы добавить помещение в инфраструктуру.",
            component: <InfrastructureForm {...formProps} />,
        },
        update: {
            title: "Редактирование помещения",
            description: "Измените данные о помещении.",
            component: <InfrastructureForm {...formProps} />,
        },
    };

    const activeMenu = (id: bigint): CommonPopoverProps["items"] => [
        {
            label: "Редактировать",
            icon: <PencilIcon className="h-3.5 w-3.5" />,
            onClick: () => modal.openModal("update", id),
        },
        {
            label: "Удалить",
            icon: <TrashIcon className="h-3.5 w-3.5" />,
            style: "text-destructive hover:text-destructive",
            onClick: async () => {
                if (!confirm("Вы уверены, что хотите удалить это помещение?")) return;

                try {
                    const response = await infrastructureClient.infrastructureDelete({ id });
                    if (response.success) {
                        toast.success("Помещение удалено");
                        await fetch();
                    } else {
                        toast.error(response.message || "Не удалось удалить помещение");
                    }
                } catch (error) {
                    console.error("Ошибка удаления:", error);
                    toast.error("Не удалось удалить помещение");
                }
            },
        },
    ];

    return {
        infrastructureRes: {
            fetch,
            list: listState.list,
            error: listState.error,
            empty: listState.empty,
            loading: listState.loading,
        },
        infrastructureModal: {
            ...modal,
            closeModal,
            modalConfig,
        },
        activeMenu,
    };
};

export { useInfrastructure, useInfrastructureForm, LOCATION_COMMON_TYPE_LABEL };
