import { useFetchState } from "@/features/lib/fetch";
import type { Inventory } from "@dvgmu/contract/entity/v1/inventory.entity_pb";
import { InventoryStatus, InventoryType } from "@dvgmu/contract/enum/v1/inventory.enum_pb";
import { InventoryService } from "@dvgmu/contract/service/v1/inventory.service_pb";
import { useCommonModal } from "@/shared/components/modal";
import type { CommonModalConfig } from "@/shared/components/modal";
import { connectTransport } from "@/shared/config/api";
import { createClient } from "@connectrpc/connect";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { InventoryCreateModal } from "./inventory.ui";
import { inventorySchema } from "./inventory.schema";
import type { InventorySchema } from "./inventory.schema";

const inventoryClient = createClient(InventoryService, connectTransport);

const INVENTORY_TYPE_LABEL: Record<InventoryType, string> = {
    [InventoryType.UNSPECIFIED]: "Не указано",
    [InventoryType.EQUIPMENT]: "Оборудование",
    [InventoryType.FURNITURE]: "Мебель",
    [InventoryType.ELECTRONICS]: "Электроника",
    [InventoryType.OTHER]: "Прочее",
};

const INVENTORY_STATUS_LABEL: Record<InventoryStatus, string> = {
    [InventoryStatus.UNSPECIFIED]: "Не указано",
    [InventoryStatus.IN_USE]: "В эксплуатации",
    [InventoryStatus.IN_STORAGE]: "На складе",
    [InventoryStatus.UNDER_REPAIR]: "На ремонте",
    [InventoryStatus.WRITTEN_OFF]: "Списано",
};

const INVENTORY_STATUS_BADGE_VARIANT: Record<InventoryStatus, "default" | "secondary" | "destructive" | "outline"> = {
    [InventoryStatus.UNSPECIFIED]: "outline",
    [InventoryStatus.IN_USE]: "default",
    [InventoryStatus.IN_STORAGE]: "secondary",
    [InventoryStatus.UNDER_REPAIR]: "destructive",
    [InventoryStatus.WRITTEN_OFF]: "outline",
};

interface UseInventoryFormProps {
    refresh: () => Promise<void>;
    onCloseModal: () => void;
}
const useInventoryForm = ({ refresh, onCloseModal }: UseInventoryFormProps) => {
    const form = useForm({
        resolver: zodResolver(inventorySchema),
        defaultValues: {},
    });

    const parseToTimestamp = (dateString?: string) => {
        if (!dateString) return undefined;
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return undefined;

        return {
            seconds: BigInt(Math.floor(date.getTime() / 1000)),
            nanos: 0,
        };
    };

    const handleSubmit = form.handleSubmit(async (values: InventorySchema) => {
        try {
            const response = await inventoryClient.inventoryCreate({
                title: values.title,
                description: values.description ?? "",
                inventoryNumber: values.inventoryNumber,
                serialNumber: values.serialNumber ?? "",
                purchasePrice: values.purchasePrice ?? 0,
                purchaseDate: parseToTimestamp(values.purchaseDate),
                infrastructureId: BigInt(values.locationId),
                responsibleUserId: values.responsibleUserId ? BigInt(values.responsibleUserId) : undefined,
                status: values.status as InventoryStatus,
                type: values.type as InventoryType,
            });

            if (response.success) {
                toast.success("Объект добавлен в инвентарь");
                form.reset({});
                onCloseModal();
                await refresh();
            } else {
                toast.error(response.message || "Не удалось добавить объект инвентаря");
            }
        } catch (error: any) {
            console.error("Ошибка при создании объекта инвентаря:", error);
            toast.error(error.message || "Произошла ошибка при добавлении объекта");
        }
    });

    return { form, handleSubmit };
};

type InventoryModalType = "create";

const useInventory = () => {
    const listState = useFetchState<Inventory>();
    const modal = useCommonModal<InventoryModalType>({ initialType: "create" });

    const fetch = async () => {
        listState.setLoading(true);
        listState.setError(false);

        try {
            const response = await inventoryClient.inventoryFetch({});
            listState.setList(response.list);
        } catch (error) {
            console.error("Ошибка при получении списка инвентаря:", error);
            listState.setError(true);
        } finally {
            listState.setLoading(false);
        }
    };

    const formProps = useInventoryForm({ refresh: fetch, onCloseModal: modal.closeModal });

    const modalConfig: CommonModalConfig<InventoryModalType> = {
        create: {
            title: "Добавление объекта инвентаря",
            description: "Заполните форму, чтобы добавить объект инвентаря.",
            component: <InventoryCreateModal formProps={formProps} />,
        },
    };

    return {
        fetch,
        list: listState.list,
        error: listState.error,
        empty: listState.empty,
        loading: listState.loading,
        inventoryModal: {
            ...modal,
            modalConfig,
        },
    };
};

export {
    useInventory,
    useInventoryForm,
    INVENTORY_TYPE_LABEL,
    INVENTORY_STATUS_LABEL,
    INVENTORY_STATUS_BADGE_VARIANT,
};
