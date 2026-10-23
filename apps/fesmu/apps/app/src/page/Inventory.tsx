import { CommonWrapper } from "@/shared/components/wrapper";
import { CommonSearchInput } from "@/shared/components/filter";
import { InventoryList, useInventory } from "@/widgets/inventory";
import { InfrastructurePicker, useInfrastructure } from "@/widgets/infrastructure";
import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function InventoryPage() {
    const { fetch, list, loading, error, empty, inventoryModal } = useInventory();
    const { infrastructureRes } = useInfrastructure();

    const [selectedLocationId, setSelectedLocationId] = useState<bigint | undefined>();
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch();
        infrastructureRes.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const locationLabelById = useMemo(
        () => new Map(infrastructureRes.list.map((item) => [item.id, item.title])),
        [infrastructureRes.list],
    );

    const filteredList = useMemo(() => {
        const query = search.trim().toLowerCase();

        return list.filter((item) => {
            if (selectedLocationId !== undefined && item.infrastructureId !== selectedLocationId) return false;

            if (!query) return true;
            return (
                item.inventoryNumber?.toLowerCase().includes(query) ||
                item.serialNumber?.toLowerCase().includes(query) ||
                item.title?.toLowerCase().includes(query)
            );
        });
    }, [list, selectedLocationId, search]);

    return (
        <CommonWrapper
            title="Инвентарь"
            description="Список объектов инвентаря"
            action={
                <PlusIcon
                    className="size-4 cursor-pointer"
                    onClick={() => inventoryModal.openModal("create")}
                />
            }
            filter={{
                render: {
                    count: filteredList.length,
                    children: (
                        <div className="flex items-center gap-3">
                            <CommonSearchInput
                                value={search}
                                onChange={setSearch}
                                placeholder="Поиск по ШК, серийному номеру или названию"
                            />

                            <InfrastructurePicker
                                list={infrastructureRes.list}
                                value={selectedLocationId}
                                onChange={setSelectedLocationId}
                            />
                        </div>
                    ),
                },
            }}
        >
            <InventoryList
                list={filteredList}
                locationLabelById={locationLabelById}
                inventoryModal={inventoryModal}
                isLoading={loading}
                isError={!!error}
                isEmpty={empty}
            />
        </CommonWrapper>
    )
}
