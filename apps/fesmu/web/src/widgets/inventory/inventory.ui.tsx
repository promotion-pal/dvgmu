import type { ComponentProps, FC } from "react";
import { BoxIcon, MapPinIcon } from "lucide-react";
import { Card } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import type { Inventory } from "@fesmu/contract/fesmu/entity/v1/inventory.entity_pb";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonModal } from "@/shared/components/modal";
import { formatDate } from "@/features/utils/date";
import { formatMoney } from "@/features/utils/amount";
import { INVENTORY_STATUS_BADGE_VARIANT, INVENTORY_STATUS_LABEL, INVENTORY_TYPE_LABEL } from "./Inventory.fn";
import type { useInventory } from "./Inventory.fn";
import { InventoryForm } from "./inventory.form";

interface InventoryCreateModalProps {
    formProps: ComponentProps<typeof InventoryForm>;
}
const InventoryCreateModal: FC<InventoryCreateModalProps> = ({ formProps }) => {
    return <InventoryForm {...formProps} />;
};

export { InventoryCreateModal };

interface InventoryListProps extends ComponentProps<typeof CommonControlState> {
    list: Inventory[];
    locationLabelById?: Map<bigint, string>;
    inventoryModal: ReturnType<typeof useInventory>["inventoryModal"];
}
const InventoryList: FC<InventoryListProps> = ({ list, locationLabelById, inventoryModal, ...state }) => {
    return (
        <>
            <CommonControlState {...state}>
                <section className="grid md:grid-cols-3 gap-4">
                    {list.map((item) => (
                        <InventoryListItem
                            item={item}
                            key={item.id.toString()}
                            locationLabel={locationLabelById?.get(item.infrastructureId)}
                        />
                    ))}
                </section>
            </CommonControlState>

            <CommonModal
                {...inventoryModal}
                title={inventoryModal.modalConfig[inventoryModal.type].title}
                description={inventoryModal.modalConfig[inventoryModal.type].description}
            >
                {inventoryModal.modalConfig[inventoryModal.type].component}
            </CommonModal>
        </>
    );
};

interface InventoryListItemProps {
    item: Inventory;
    locationLabel?: string;
}
const InventoryListItem: FC<InventoryListItemProps> = ({ item, locationLabel }) => {
    return (
        <Card className="p-4 border border-slate-100 rounded-xl shadow-sm bg-white hover:border-slate-200 transition-colors">
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                    <p className="icon-inline gap-2 font-semibold text-base text-slate-800 tracking-tight">
                        <BoxIcon className="size-4 text-muted-foreground shrink-0" />
                        {item.title || "Без названия"}
                    </p>

                    <Badge variant={INVENTORY_STATUS_BADGE_VARIANT[item.status]}>
                        {INVENTORY_STATUS_LABEL[item.status]}
                    </Badge>
                </div>

                {item.description && (
                    <p className="text-sm text-slate-600 line-clamp-3">{item.description}</p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    {item.inventoryNumber && <span>Инв. №{item.inventoryNumber}</span>}
                    {item.serialNumber && <span>С/н {item.serialNumber}</span>}
                    <span>{INVENTORY_TYPE_LABEL[item.type]}</span>
                </div>

                {locationLabel && (
                    <p className="icon-inline gap-1.5 text-xs text-slate-400">
                        <MapPinIcon className="size-3 shrink-0" />
                        {locationLabel}
                    </p>
                )}

                <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
                    <span>{formatMoney(item.purchasePrice)}</span>
                    <span>{formatDate("date", item.purchaseDate)}</span>
                </div>
            </div>
        </Card>
    );
};

export { InventoryList };
