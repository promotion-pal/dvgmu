import { CommonFilterChips, CommonFilterSelect, CommonSearchInput } from "@/shared/components/filter";
import { CommonModal } from "@/shared/components/modal";
import { CommonWrapper } from "@/shared/components/wrapper";
import { urlCodec, useUrlState } from "@/features/lib/url-state";
import type { UrlStateSchema } from "@/features/lib/url-state";
import { cn } from "@/shared/lib/utils";
import { Card } from "@/shared/ui/card";
import { InfrastructureList, useInfrastructure, useInfrastructureFilter } from "@/widgets/infrastructure";
import { LOCATION_COMMON_TYPE_LABEL } from "@/widgets/infrastructure/infrastructure.fn";
import { useInventory } from "@/widgets/inventory";
import { LocationCommonType } from "@fesmu/contract/enum/v1/location.enum_pb";
import { BoxIcon, ListIcon, PencilIcon, PlusIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { Suspense, lazy, useEffect, useMemo } from "react";

// three.js is heavy; it is loaded only when someone opens the model.
const InfrastructureModel = lazy(() => import("@/widgets/infrastructure/infrastructure.model"));

type InfrastructureView = "list" | "model";
interface ViewState {
    view: InfrastructureView;
    roomId?: number;
}
const VIEW_SCHEMA: UrlStateSchema<ViewState> = {
    view: { key: "view", codec: urlCodec.oneOf(["list", "model"] as const) },
    roomId: { key: "room", codec: urlCodec.integer },
};
const VIEW_FALLBACK: ViewState = { view: "list" };

const LOCATION_OPTIONS = Object.entries(LOCATION_COMMON_TYPE_LABEL).map(([value, label]) => ({ value, label }));

export default function InfrastructurePage() {
    const { infrastructureRes, infrastructureModal, activeMenu } = useInfrastructure();
    const { filter, setFilter, floorOptions, filtered } = useInfrastructureFilter(infrastructureRes.list);
    const [{ view, roomId }, setView] = useUrlState(VIEW_SCHEMA, VIEW_FALLBACK);

    useEffect(() => {
        infrastructureRes.fetch();
    }, []);

    const highlighted = useMemo(() => new Set(filtered.map((item) => item.id)), [filtered]);
    const selectedId = roomId !== undefined ? BigInt(roomId) : undefined;
    const selected = infrastructureRes.list.find((item) => item.id === selectedId);

    return (
        <CommonWrapper
            title="Инфраструктура"
            description="Управление помещениями и инфраструктурой"
            action={
                <div className="flex items-center gap-3">
                    <ViewToggle view={view} onChange={(next) => setView((current) => ({ ...current, view: next }))} />
                    <PlusIcon
                        className="size-4 cursor-pointer"
                        onClick={() => infrastructureModal.openModal("create")}
                    />
                </div>
            }
            filter={{
                render: {
                    count: filtered.length,
                    children: (
                        <div className="flex flex-wrap items-end gap-4">
                            <CommonSearchInput
                                value={filter.search}
                                onChange={(search) => setFilter((current) => ({ ...current, search }))}
                                placeholder="Номер или название помещения"
                            />

                            <CommonFilterChips
                                label="Этаж"
                                options={floorOptions}
                                value={filter.floors}
                                onChange={(floors) => setFilter((current) => ({ ...current, floors }))}
                            />

                            <CommonFilterSelect
                                label="Тип помещения"
                                allLabel="Все типы"
                                options={LOCATION_OPTIONS}
                                value={filter.location !== undefined ? String(filter.location) : undefined}
                                onChange={(location) =>
                                    setFilter((current) => ({ ...current, location: location !== undefined ? Number(location) : undefined }))
                                }
                            />
                        </div>
                    ),
                },
            }}
        >
            {view === "list" ? (
                <InfrastructureList
                    activeMenu={activeMenu}
                    infrastructureModal={infrastructureModal}
                    list={filtered}
                    isEmpty={infrastructureRes.empty}
                    isLoading={infrastructureRes.loading}
                    isError={!!infrastructureRes.error}
                />
            ) : (
                <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
                    <Suspense fallback={<div className="h-[70vh] min-h-105 animate-pulse rounded-xl bg-muted/40" />}>
                        <InfrastructureModel
                            list={infrastructureRes.list}
                            highlighted={highlighted}
                            floors={filter.floors}
                            selectedId={selectedId}
                            onSelect={(id) => setView((current) => ({ ...current, roomId: id !== undefined ? Number(id) : undefined }))}
                        />
                    </Suspense>

                    <RoomPanel
                        room={selected}
                        onClose={() => setView((current) => ({ ...current, roomId: undefined }))}
                        onEdit={(id) => infrastructureModal.openModal("update", id)}
                    />

                    <CommonModal
                        {...infrastructureModal}
                        title={infrastructureModal.modalConfig[infrastructureModal.type].title}
                        description={infrastructureModal.modalConfig[infrastructureModal.type].description}
                    >
                        {infrastructureModal.modalConfig[infrastructureModal.type].component}
                    </CommonModal>
                </div>
            )}
        </CommonWrapper>
    );
}

const ViewToggle: FC<{ view: InfrastructureView; onChange: (view: InfrastructureView) => void }> = ({ view, onChange }) => {
    const options = [
        { key: "list" as const, label: "Список", icon: ListIcon },
        { key: "model" as const, label: "Макет", icon: BoxIcon },
    ];

    return (
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-muted/40">
            {options.map(({ key, label, icon: Icon }) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    className={cn(
                        "icon-inline gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors",
                        view === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    <Icon className="size-3.5" />
                    {label}
                </button>
            ))}
        </div>
    );
};

interface RoomPanelProps {
    room?: ReturnType<typeof useInfrastructure>["infrastructureRes"]["list"][number];
    onClose: () => void;
    onEdit: (id: bigint) => void;
}
const RoomPanel: FC<RoomPanelProps> = ({ room, onClose, onEdit }) => {
    const inventory = useInventory();

    useEffect(() => {
        inventory.fetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!room) {
        return (
            <Card className="h-fit p-4 text-sm text-muted-foreground">
                Нажмите на кабинет на макете, чтобы увидеть его карточку и инвентарь.
            </Card>
        );
    }

    const items = inventory.list.filter((item) => item.infrastructureId === room.id);

    return (
        <Card className="h-fit p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="font-semibold text-base">{room.title}</p>
                    <p className="text-xs text-muted-foreground">
                        {[room.floor ? `${room.floor} этаж` : "", room.location !== LocationCommonType.UNSPECIFIED ? LOCATION_COMMON_TYPE_LABEL[room.location] : ""]
                            .filter(Boolean)
                            .join(" · ")}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <PencilIcon className="size-4 cursor-pointer hover:text-foreground" onClick={() => onEdit(room.id)} />
                    <XIcon className="size-4 cursor-pointer hover:text-foreground" onClick={onClose} />
                </div>
            </div>

            {room.description && <p className="text-sm text-muted-foreground">{room.description}</p>}

            <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">Инвентарь · {items.length}</p>
                {inventory.loading && <p className="text-xs text-muted-foreground">Загрузка…</p>}
                {!inventory.loading && items.length === 0 && <p className="text-sm text-muted-foreground">Инвентаря нет</p>}
                {items.map((item) => (
                    <div key={item.id.toString()} className="flex justify-between gap-2 text-sm">
                        <span className="truncate">{item.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{item.inventoryNumber}</span>
                    </div>
                ))}
            </div>
        </Card>
    );
};
