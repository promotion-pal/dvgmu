import type { Infrastructure } from "@dvgmu/contract/fesmu/entity/v1/infrastructure.entity_pb";
import { CommonPopover } from "@/shared/components/menu";
import { CommonControlState } from "@/shared/components/state/control-state";
import { CommonModal } from "@/shared/components/modal";
import { Card } from "@/shared/ui/card";
import type { ComponentProps, FC } from "react";
import { Building2Icon, UsersIcon } from "lucide-react";
import { LocationCommonType } from "@dvgmu/contract/fesmu/enum/v1/location.enum_pb";
import { LOCATION_COMMON_TYPE_LABEL } from "./infrastructure.fn";
import type { useInfrastructure } from "./infrastructure.fn";
import { floorLabel, groupByFloor } from "./infrastructure.filter";

interface InfrastructureProps {
    activeMenu: ReturnType<typeof useInfrastructure>["activeMenu"]
}

interface InfrastructureListProps extends ComponentProps<typeof CommonControlState>, InfrastructureProps {
    list: Infrastructure[]
    infrastructureModal: ReturnType<typeof useInfrastructure>["infrastructureModal"]
}
const InfrastructureList: FC<InfrastructureListProps> = ({ list, activeMenu, infrastructureModal, ...state }) => {
    return (
        <>
            <CommonControlState {...state}>
                <div className="flex flex-col gap-8">
                    {groupByFloor(list).map(group => (
                        <section key={group.floor} className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <p className="h3">{floorLabel(group.floor)}</p>
                                <span className="text-xs text-muted-foreground">{group.items.length}</span>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {group.items.map(item => <InfrastructureItem
                                    item={item}
                                    key={item.id.toString()}
                                    activeMenu={activeMenu}
                                />)}
                            </div>
                        </section>
                    ))}
                </div>
            </CommonControlState>

            <CommonModal
                {...infrastructureModal}
                title={infrastructureModal.modalConfig[infrastructureModal.type].title}
                description={infrastructureModal.modalConfig[infrastructureModal.type].description}
            >
                {infrastructureModal.modalConfig[infrastructureModal.type].component}
            </CommonModal>
        </>
    );
};

interface InfrastructureItemProps extends InfrastructureProps {
    item: Infrastructure
}
const InfrastructureItem: FC<InfrastructureItemProps> = ({ item, activeMenu }) => {
    return (
        <Card className="p-4 border border-slate-100 rounded-xl shadow-sm bg-white hover:border-slate-200 transition-colors">
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-start gap-4">
                    <p className="icon-inline gap-2 font-semibold text-base text-slate-800 tracking-tight">
                        <Building2Icon className="size-4 text-muted-foreground shrink-0" />
                        {item.title || "Без названия"}
                    </p>

                    {activeMenu && (
                        <CommonPopover items={activeMenu(item.id)} />
                    )}
                </div>

                {item.description && (
                    <p className="text-sm text-slate-600 line-clamp-3">
                        {item.description}
                    </p>
                )}

                <div className="flex items-center justify-between gap-4 text-xs text-slate-400">
                    <span>
                        {[
                            item.floor ? `Этаж ${item.floor}` : "",
                            item.room && !item.title.includes(String(item.room)) ? `каб. ${item.room}` : "",
                            item.location !== LocationCommonType.UNSPECIFIED ? LOCATION_COMMON_TYPE_LABEL[item.location] : "",
                        ].filter(Boolean).join(" · ")}
                    </span>

                    {item.userIds.length > 0 && (
                        <span className="icon-inline gap-1">
                            <UsersIcon className="size-3" />
                            {item.userIds.length}
                        </span>
                    )}
                </div>
            </div>
        </Card>
    );
};

export { InfrastructureList };
